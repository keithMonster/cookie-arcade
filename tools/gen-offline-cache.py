#!/usr/bin/env python3
"""生成 Cookie 游戏台的离线预缓存清单。

运行时资源只来自根页面/PWA 图标和 games/。脚本把资源路径与内容 hash 写进
service-worker.js；任何资源新增、删除或内容变化都会改变缓存版本。

用法：
    python3 tools/gen-offline-cache.py
    python3 tools/gen-offline-cache.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVICE_WORKER = ROOT / "service-worker.js"
ROOT_ASSETS = ("index.html", "manifest.json", "icon-512.png", "apple-touch-icon.png")
RUNTIME_SUFFIXES = {
    ".html",
    ".js",
    ".css",
    ".mp3",
    ".wav",
    ".ogg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
    ".json",
}
BEGIN = "// BEGIN GENERATED OFFLINE MANIFEST"
END = "// END GENERATED OFFLINE MANIFEST"


def runtime_files() -> list[Path]:
    files = [ROOT / name for name in ROOT_ASSETS]
    files.extend(
        path
        for path in (ROOT / "games").rglob("*")
        if path.is_file()
        and path.suffix.lower() in RUNTIME_SUFFIXES
        and not any(part.startswith(".") for part in path.relative_to(ROOT).parts)
    )
    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def cache_paths(files: list[Path]) -> list[str]:
    paths = ["./"]
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        paths.append(f"./{relative}")

    game_dirs = sorted(
        path.parent.relative_to(ROOT).as_posix()
        for path in files
        if path.name == "index.html" and path.parent.parent == ROOT / "games"
    )
    paths.extend(f"./{directory}/" for directory in game_dirs)
    return sorted(set(paths))


def version(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(ROOT).as_posix().encode()
        digest.update(relative)
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:16]


def generated_block(files: list[Path]) -> str:
    paths = cache_paths(files)
    rendered = ",\n".join(f"  {json.dumps(path)}" for path in paths)
    return (
        f"{BEGIN}\n"
        f"const CACHE_VERSION = {json.dumps(version(files))};\n"
        f"const PRECACHE_PATHS = [\n{rendered}\n];\n"
        f"{END}"
    )


def expected_source() -> tuple[str, int, str]:
    files = runtime_files()
    missing = [path for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError(", ".join(str(path) for path in missing))

    source = SERVICE_WORKER.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"{re.escape(BEGIN)}.*?{re.escape(END)}",
        flags=re.DOTALL,
    )
    if not pattern.search(source):
        raise ValueError("service-worker.js 缺少离线清单生成标记")

    block = generated_block(files)
    return pattern.sub(block, source, count=1), len(cache_paths(files)), version(files)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只检查生成结果是否最新")
    args = parser.parse_args()

    try:
        expected, count, cache_version = expected_source()
    except (FileNotFoundError, ValueError) as exc:
        print(f"✗ 离线清单生成失败：{exc}")
        return 1

    current = SERVICE_WORKER.read_text(encoding="utf-8")
    if args.check:
        if current != expected:
            print("✗ service-worker.js 离线清单已过期，请运行 python3 tools/gen-offline-cache.py")
            return 1
        print(f"✓ 离线清单一致 —— {count} 个 URL，版本 {cache_version}")
        return 0

    SERVICE_WORKER.write_text(expected, encoding="utf-8")
    print(f"✓ 已生成离线清单 —— {count} 个 URL，版本 {cache_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
