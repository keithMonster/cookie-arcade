#!/usr/bin/env python3
"""文档一致性检查：防 WHY.md 的能力线地图与 README 存量表脱节。

WHY.md 用两张表描述全台 20 款的位置（toy→game 轴分布 + 能力线地图），
新增游戏时若只改 README 不回头改 WHY.md，地图就开始骗人——而骗人的地图
比没有地图更糟，因为准入四问第 2 问要靠它选址。本脚本就是那个传感器。

检查项（任一失败退出码 1）：
    1. README「## Games (N)」标题里的 N 与表内实际款数一致
    2. WHY.md toy→game 轴表三档款数之和 == README 总款数
    3. games/ 磁盘上的游戏目录数 == README 总款数（防做了没登记 / 登记了没做）
    4. README 里每个游戏名都在 WHY.md 中出现过（新增游戏必须在地图上落位）
    5. 根目录 md 之间的相对链接不指向不存在或被 .gitignore 挡住的文件
       （public 仓读者看不到 ignored 文件，链过去就是死链）

用法：
    python3 tools/check-docs.py
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ["README.md", "CLAUDE.md", "WHY.md", "STORY.md"]


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


def parse_readme_games(text):
    """从 README 的 Games 表提取 (标题声明数, 款名列表, 实际款数)。

    表里存在 "12-16 | Twirlywoos × 5" 这种合并行，一行代表 5 款，
    故实际款数按行首编号区间累加，不等于行数。
    """
    declared = None
    m = re.search(r"^##\s+Games\s*\((\d+)\)", text, re.M)
    if m:
        declared = int(m.group(1))

    names, actual = [], 0
    for line in text.splitlines():
        row = re.match(r"^\|\s*(\d+)(?:-(\d+))?\s*\|\s*\*\*(.+?)\*\*", line)
        if not row:
            continue
        start, end, name = row.group(1), row.group(2), row.group(3)
        actual += (int(end) - int(start) + 1) if end else 1
        # README 是中英双名（"睡觉觉 Sleep Tight" / "Twirlywoos × 5"），
        # 取空格前的首段作匹配键 —— 中文名是全台文档里通用的那个称呼
        names.append(name.split()[0].strip())
    return declared, names, actual


def parse_why_axis(text):
    """从 WHY.md 的 toy→game 轴表提取各档款数（表格第三列的整数）。"""
    counts = []
    for line in text.splitlines():
        if not line.startswith("|") or "**" not in line:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 3 and cells[1].isdigit():
            counts.append(int(cells[1]))
    return counts


def git_ignored(path):
    r = subprocess.run(
        ["git", "check-ignore", "-q", path], cwd=ROOT, capture_output=True
    )
    return r.returncode == 0


def main():
    failures = []
    readme, why = read("README.md"), read("WHY.md")

    # 1 + 2：款数三方对账
    declared, names, actual = parse_readme_games(readme)
    if declared is not None and declared != actual:
        failures.append(f"README 标题写 Games ({declared})，表里实际 {actual} 款")

    axis = parse_why_axis(why)
    if sum(axis) != actual:
        failures.append(
            f"WHY.md toy→game 轴表合计 {sum(axis)} 款（{axis}），README 是 {actual} 款"
            " —— 新增游戏后忘了更新 WHY.md 的分布表"
        )

    # 3：文档 vs 磁盘 —— 唯一一条锚在物理事实上的对账
    on_disk = sorted(
        d.name for d in (ROOT / "games").iterdir() if d.is_dir() and d.name != "_lib"
    )
    if len(on_disk) != actual:
        failures.append(
            f"games/ 磁盘上有 {len(on_disk)} 个游戏目录，README 说 {actual} 款"
            " —— 做了没登记，或登记了没做"
        )

    # 4：每款都要在地图上有位置
    missing = [n for n in names if n not in why]
    if missing:
        failures.append(
            "这些游戏在 WHY.md 里查无落位（准入四问第 2 问会选址失败）："
            + "、".join(missing)
        )

    # 5：进仓文档的相对链接不能指向仓外文件
    for doc in DOCS:
        for target in set(re.findall(r"\]\(([A-Za-z0-9_.-]+\.md)\)", read(doc))):
            if not (ROOT / target).exists():
                failures.append(f"{doc} 链接的 {target} 不存在")
            elif git_ignored(target):
                failures.append(
                    f"{doc} 链接的 {target} 被 .gitignore 挡住 —— 对 GitHub 上的读者是死链"
                )

    if failures:
        print("✗ 文档一致性检查未通过：")
        for f in failures:
            print(f"  · {f}")
        return 1

    print(f"✓ 文档一致 —— {actual} 款全部在 WHY.md 地图上落位，链接无死链")
    return 0


if __name__ == "__main__":
    sys.exit(main())
