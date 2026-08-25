#!/usr/bin/env python3
"""cookie-arcade 全站语音统一生成脚本（火山引擎 灿灿 音色）。

2026-07-16 起替代原 6 个 gen-*-audio.sh（macOS say -v Tingting）：
音色换成火山豆包 TTS V3 的「灿灿」（zh_female_cancan_uranus_bigtts），
自然甜美人声，比 say 的机械音更适合 2 岁小朋友。
全部 11 款游戏的文案表收编在本文件 MANIFEST 一处（words/find 词表直接
解析 games/_lib/words-data.js，不再维护第二份副本）。

停顿处理：火山大模型 TTS 不支持 say 的 [[slnc N]] 停顿语法——
短停顿（150-300ms）交给标点自然韵律；教学用的长留白（600-700ms 引导跟读）
用 ffmpeg 在词段之间拼真静音（seq 类条目）。

凭据（不进 git）：环境变量 DOUBAO_TTS_APP_ID / DOUBAO_TTS_ACCESS_KEY，
缺失时回退读本机 voice-reply skill 的 .env。

用法：
    python3 tools/gen-audio.py --check           # 只核对 manifest ↔ 磁盘文件名双射，不调 API
    python3 tools/gen-audio.py --game words      # 只生成一款游戏
    python3 tools/gen-audio.py --only apple      # 只生成文件名含 apple 的条目（试听样本用）
    python3 tools/gen-audio.py                   # 全量生成（同名覆盖）
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "games"

VOLC_V3_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
SPEAKER = "zh_female_cancan_uranus_bigtts"  # 灿灿
RESOURCE_ID = "seed-tts-2.0"                # uranus 族 → seed-tts-2.0（voice-reply tts.py 同款路由）
HTTP_TIMEOUT = 20
WORD_SPEED = 0.85   # 单词示范段放慢一点，方便跟读
SENT_SPEED = 1.0    # 整句正常语速

# 火山 TTS 波形自带 ~0.5s 前导静音 + ~0.55s 尾部静音，点击后要空等半秒才出声。
# 合成后统一裁掉，只保留少量缓冲（首 80ms 免起音突兀 / 尾 120ms 免收音戛止）。
TRIM_THRESHOLD = "-40dB"
TRIM_HEAD_KEEP = 0.08
TRIM_TAIL_KEEP = 0.12


def trim_silence(path: Path) -> None:
    """裁掉 mp3 首尾静音（保留少量缓冲），原地覆盖。中间的停顿不动。"""
    tmp = path.with_suffix(".trim.mp3")
    af = (
        f"silenceremove=start_periods=1:start_threshold={TRIM_THRESHOLD}:start_silence={TRIM_HEAD_KEEP},"
        "areverse,"
        f"silenceremove=start_periods=1:start_threshold={TRIM_THRESHOLD}:start_silence={TRIM_TAIL_KEEP},"
        "areverse"
    )
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af", af,
           "-ac", "1", "-ar", "24000", "-b:a", "64k", str(tmp)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not tmp.is_file() or tmp.stat().st_size < 1024:
        tmp.unlink(missing_ok=True)
        sys.exit(f"裁静音失败：{path}\n{r.stderr}")
    os.replace(tmp, path)


def load_credentials() -> tuple[str, str]:
    appid = os.environ.get("DOUBAO_TTS_APP_ID")
    key = os.environ.get("DOUBAO_TTS_ACCESS_KEY")
    if appid and key:
        return appid, key
    env_path = Path.home() / ".agents/skills/voice-reply/.env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        appid = os.environ.get("DOUBAO_TTS_APP_ID")
        key = os.environ.get("DOUBAO_TTS_ACCESS_KEY")
    if not (appid and key):
        sys.exit("缺凭据：请设置 DOUBAO_TTS_APP_ID / DOUBAO_TTS_ACCESS_KEY")
    return appid, key


def load_words() -> list[tuple[str, str]]:
    """从 games/_lib/words-data.js 解析 (key, word) 列表——词库单一数据源。"""
    src = (GAMES / "_lib/words-data.js").read_text(encoding="utf-8")
    pairs = re.findall(r"word:\s*'([^']+)',\s*key:\s*'([^']+)'", src)
    words = [(key, word) for word, key in pairs]
    if len(words) < 40:
        sys.exit(f"words-data.js 解析异常：只解析到 {len(words)} 词（预期 50）")
    return words


# ---------------------------------------------------------------------------
# MANIFEST：game → { 文件名: spec }
#   spec = ("text", 文案, 语速)            —— 单次合成直出
#   spec = ("seq", [段落|停顿ms, ...])      —— 分段合成 + ffmpeg 拼静音
#          段落 = (文案, 语速)
#   spec = ("copy", "相对 games/ 的源文件")  —— 直接复制（tw-summon 复用 storybook）
# ---------------------------------------------------------------------------
def build_manifest() -> dict[str, dict[str, tuple]]:
    words = load_words()

    m: dict[str, dict[str, tuple]] = {}

    # words 学说话：词念两遍、中间 700ms 留白引导跟读
    m["words"] = {
        f"{k}.mp3": ("seq", [(w, WORD_SPEED), 700, (w, WORD_SPEED)]) for k, w in words
    }

    # find 找一找：q_ 问题 / y_ 表扬（答对瞬间再念两遍强化）
    m["find"] = {}
    for k, w in words:
        m["find"][f"q_{k}.mp3"] = ("text", f"{w}在哪里呀？", SENT_SPEED)
        m["find"][f"y_{k}.mp3"] = ("seq", [("对啦！", SENT_SPEED), 300, (w, WORD_SPEED), 600, (w, WORD_SPEED)])

    # shapes 送回家
    shapes = [("circle", "圆形"), ("square", "方形"), ("triangle", "三角形"),
              ("star", "星星"), ("heart", "爱心"), ("moon", "月亮")]
    m["shapes"] = {}
    for k, w in shapes:
        m["shapes"][f"q_{k}.mp3"] = ("text", f"{w}的家！{w}在哪里呀？", SENT_SPEED)
        m["shapes"][f"y_{k}.mp3"] = ("text", f"对啦！{w}回家啦！", SENT_SPEED)

    # feed 喂一喂
    pets = [("cat", "小猫", "小鱼"), ("dog", "小狗", "骨头"), ("rabbit", "兔子", "胡萝卜"),
            ("monkey", "猴子", "香蕉"), ("panda", "熊猫", "竹子"), ("cow", "奶牛", "青草"),
            ("chicken", "母鸡", "玉米"), ("elephant", "大象", "苹果")]
    m["feed"] = {}
    for k, name, food in pets:
        m["feed"][f"fav_{k}.mp3"] = ("text", f"哇！{name}最爱吃{food}啦！", SENT_SPEED)
        m["feed"][f"full_{k}.mp3"] = ("text", f"嗝！{name}吃饱啦！", SENT_SPEED)
    m["feed"]["yum_1.mp3"] = ("text", "啊呜！真好吃！", SENT_SPEED)
    m["feed"]["yum_2.mp3"] = ("text", "啊呜啊呜，好吃好吃！", SENT_SPEED)
    m["feed"]["yum_3.mp3"] = ("text", "哇哦，太好吃啦！", SENT_SPEED)
    # 喂错拒绝音（三条轮换，跨动物共用）：只有最爱才通过，喂错摇头不吃
    m["feed"]["no_1.mp3"] = ("text", "咦？我不爱吃这个呀！", SENT_SPEED)
    m["feed"]["no_2.mp3"] = ("text", "这个不是我最爱的，换一个嘛！", SENT_SPEED)
    m["feed"]["no_3.mp3"] = ("text", "摇摇头，我想吃别的！", SENT_SPEED)

    # peekaboo 躲猫猫：惊喜揭晓
    peek = [("cat", "小猫"), ("dog", "小狗"), ("rabbit", "小兔子"), ("cow", "奶牛"),
            ("frog", "青蛙"), ("tiger", "老虎"), ("monkey", "猴子"), ("penguin", "企鹅"),
            ("chick", "小鸡"), ("fox", "狐狸"), ("panda", "熊猫"), ("bear", "小熊")]
    m["peekaboo"] = {f"{k}.mp3": ("text", f"哇！是{name}！", SENT_SPEED) for k, name in peek}

    # storybook 谁在门后面：旁白（原 [[slnc]] 停顿改标点韵律）
    story = {
        "intro": "我们来玩躲猫猫吧！",
        "ask_1": "咚咚咚，谁在门后面呀？",
        "ask_2": "这扇门后面，又是谁呢？",
        "ask_3": "听，里面有声音！谁呀？",
        "ask_4": "最后一扇门，敲一敲！",
        "reveal_bighoo": "哇！是蓝呼呼！呼——",
        "reveal_toodloo": "哇！是红涂涂！涂——",
        "reveal_chickedy": "哇！是唧唧！唧唧唧！",
        "reveal_chick": "哇！是啾啾！啾啾！",
        "finale": "找到所有的呼呼啦！",
    }
    m["storybook"] = {f"{k}.mp3": ("text", t, SENT_SPEED) for k, t in story.items()}

    # tw-summon 召唤鸟鸟：自包含复制 storybook 的 4 条揭晓音
    m["tw-summon"] = {
        f"reveal_{c}.mp3": ("copy", f"storybook/audio/reveal_{c}.mp3")
        for c in ("bighoo", "toodloo", "chickedy", "chick")
    }

    # animals 动物园：「名字，拟声词」
    animals = [("cat", "小猫", "喵"), ("dog", "小狗", "汪汪"), ("mouse", "小老鼠", "吱吱"),
               ("rabbit", "小兔子", "蹦蹦跳"), ("cow", "奶牛", "哞"), ("pig", "小猪", "哼哼"),
               ("sheep", "绵羊", "咩"), ("chicken", "母鸡", "咯咯哒"), ("duck", "鸭子", "嘎嘎"),
               ("horse", "小马", "哒哒哒"), ("tiger", "老虎", "嗷呜"), ("lion", "狮子", "吼"),
               ("elephant", "大象", "长鼻子"), ("monkey", "猴子", "吱吱"), ("bee", "蜜蜂", "嗡嗡"),
               ("frog", "青蛙", "呱呱"), ("bird", "小鸟", "啾啾")]
    m["animals"] = {f"{k}.mp3": ("text", f"{name}，{cry}！", SENT_SPEED) for k, name, cry in animals}

    # cars 车车：「名字，拟声词」
    cars = [("bus", "校车", "嘀嘀"), ("firetruck", "消防车", "呜呜呜"),
            ("police", "警车", "嘀嘟嘀嘟"), ("ambulance", "救护车", "呜哇呜哇"),
            ("tractor", "拖拉机", "突突突"), ("truck", "大卡车", "嘟嘟"),
            ("car", "小汽车", "滴滴"), ("train", "小火车", "呜呜呜，哐当哐当"),
            ("motorbike", "摩托车", "嗡嗡嗡")]
    m["cars"] = {f"{k}.mp3": ("text", f"{name}，{cry}！", SENT_SPEED) for k, name, cry in cars}

    # bath 洗澡澡：dirty_ 开场求助 / clean_ 洗净表扬（动物池与 feed 同源）
    bath = [("cat", "小猫"), ("dog", "小狗"), ("rabbit", "兔子"), ("monkey", "猴子"),
            ("panda", "熊猫"), ("cow", "奶牛"), ("chicken", "母鸡"), ("elephant", "大象")]
    m["bath"] = {}
    for k, name in bath:
        m["bath"][f"dirty_{k}.mp3"] = ("text", f"{name}脏脏的，帮它洗澡澡吧！", SENT_SPEED)
        m["bath"][f"clean_{k}.mp3"] = ("text", f"哇！{name}洗得干干净净！", SENT_SPEED)

    # basket 装一装：拖水果进篮，放一个数一个（数量感首款）
    # count_ 逐个点数（口语点数说「两个」不说「二个」）/ intro_ 开场引导 / done_ 装满收尾
    fruits = [("apple", "苹果"), ("banana", "香蕉"), ("orange", "橘子"), ("strawberry", "草莓")]
    cn_num = {1: "一", 2: "两", 3: "三", 4: "四", 5: "五"}
    m["basket"] = {}
    for n in range(1, 6):
        m["basket"][f"count_{n}.mp3"] = ("text", f"{cn_num[n]}个！", SENT_SPEED)
    for k, name in fruits:
        m["basket"][f"intro_{k}.mp3"] = ("text", f"把{name}装进小篮子里吧！", SENT_SPEED)
        for n in (3, 4, 5):
            m["basket"][f"done_{k}_{n}.mp3"] = ("text", f"哇！{cn_num[n]}个{name}，全部装进来啦！", SENT_SPEED)

    # sleep 睡觉觉：sleepy_ 困了求盖被 / night_ 盖好晚安（动物池与 bath/feed 同源）
    # 晚安句放慢到 0.9——睡前收尾场景，语气跟着软下来
    sleep = [("cat", "小猫"), ("dog", "小狗"), ("rabbit", "兔子"), ("monkey", "猴子"),
             ("panda", "熊猫"), ("cow", "奶牛"), ("chicken", "母鸡"), ("elephant", "大象")]
    m["sleep"] = {}
    for k, name in sleep:
        m["sleep"][f"sleepy_{k}.mp3"] = ("text", f"{name}困了，帮它盖上小被子吧！", SENT_SPEED)
        m["sleep"][f"night_{k}.mp3"] = ("text", f"嘘，晚安，{name}，做个好梦。", 0.9)

    # train 排排队：听指令按顺序送动物上火车（序列记忆首款）
    # 指令三段式「先 / 轮到 / 最后」是这款游戏的存在理由；动物池与 bath/feed/sleep 同源
    train = [("cat", "小猫"), ("dog", "小狗"), ("rabbit", "兔子"), ("monkey", "猴子"),
             ("panda", "熊猫"), ("cow", "奶牛"), ("chicken", "母鸡"), ("elephant", "大象")]
    m["train"] = {}
    for k, name in train:
        m["train"][f"first_{k}.mp3"] = ("text", f"{name}，先上车！", SENT_SPEED)
        m["train"][f"next_{k}.mp3"] = ("text", f"轮到{name}啦！", SENT_SPEED)
        m["train"][f"last_{k}.mp3"] = ("text", f"最后是{name}！", SENT_SPEED)
    m["train"]["intro.mp3"] = ("text", "小火车来啦！", SENT_SPEED)
    m["train"]["go.mp3"] = ("text", "小火车出发咯，再见！", SENT_SPEED)
    # 点错（还没轮到的动物）拒绝语，两条轮换
    m["train"]["no_1.mp3"] = ("text", "还没轮到我呀！", SENT_SPEED)
    m["train"]["no_2.mp3"] = ("text", "咦，现在不是我哦！", SENT_SPEED)

    return m


# ---------------------------------------------------------------------------
# 火山 V3 合成（NDJSON 单向流式，契约同 voice-reply tts.py）
# ---------------------------------------------------------------------------
def synth(text: str, speed: float, out_path: Path, appid: str, key: str,
          silence_ms: int = 125, attempts: int = 3) -> None:
    payload = {
        "user": {"uid": "cookie-arcade"},
        "req_params": {
            "text": text,
            "speaker": SPEAKER,
            "audio_params": {
                "format": "mp3",
                "sample_rate": 24000,
                "speech_rate": round((speed - 1.0) * 100),  # [0.5,1.5] → [-50,50]
            },
            # additions 官方类型 jsonstring：序列化成 JSON 字符串再赋值
            "additions": json.dumps({"silence_duration": silence_ms}, ensure_ascii=False),
        },
    }
    req = urllib.request.Request(
        VOLC_V3_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Api-App-Id": appid,
            "X-Api-Access-Key": key,
            "X-Api-Resource-Id": RESOURCE_ID,
        },
        method="POST",
    )
    last_err = ""
    for attempt in range(1, attempts + 1):
        chunks: list[bytes] = []
        try:
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
                for raw in r:
                    line = raw.decode("utf-8").strip()
                    if not line:
                        continue
                    obj = json.loads(line)
                    code = obj.get("code")
                    if code == 20000000:  # 流正常结束
                        break
                    if code != 0:
                        raise RuntimeError(f"V3 code={code} message={obj.get('message')!r}")
                    if obj.get("data"):
                        chunks.append(base64.b64decode(obj["data"]))
            if not chunks:
                raise RuntimeError("流结束但未收到音频")
            out_path.write_bytes(b"".join(chunks))
            trim_silence(out_path)  # 段级裁剪：seq 拼接的留白由 apad 精确给，不吃 TTS 自带静音
            return
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
                RuntimeError, json.JSONDecodeError) as e:
            last_err = str(e)
            if attempt < attempts:
                time.sleep(1.5 * attempt)
    sys.exit(f"合成失败（{attempts} 次）：{text!r} → {last_err}")


def stitch(seq: list, seg_paths: list[Path], out_path: Path) -> None:
    """按 seq 顺序把音频段与静音拼成一个 mp3（重编码 mono 24kHz 48kbps）。"""
    inputs: list[str] = []
    filters: list[str] = []
    labels: list[str] = []
    seg_i = 0
    for item in seq:
        if isinstance(item, int):
            continue
        inputs += ["-i", str(seg_paths[seg_i])]
        seg_i += 1
    # 每段后面若跟停顿，用 apad 补静音
    seg_i = 0
    for idx, item in enumerate(seq):
        if isinstance(item, int):
            continue
        pad = seq[idx + 1] if idx + 1 < len(seq) and isinstance(seq[idx + 1], int) else 0
        label = f"s{seg_i}"
        if pad:
            filters.append(f"[{seg_i}:a]apad=pad_dur={pad / 1000}[{label}]")
        else:
            filters.append(f"[{seg_i}:a]acopy[{label}]")
        labels.append(f"[{label}]")
        seg_i += 1
    filters.append(f"{''.join(labels)}concat=n={seg_i}:v=0:a=1[out]")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs,
           "-filter_complex", ";".join(filters), "-map", "[out]",
           "-ac", "1", "-ar", "24000", "-b:a", "48k", str(out_path)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"ffmpeg 拼接失败：{out_path.name}\n{r.stderr}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="只核对 manifest ↔ 磁盘文件名，不调 API")
    ap.add_argument("--trim", action="store_true", help="只裁磁盘上现有 mp3 的首尾静音，不调 API")
    ap.add_argument("--game", help="只处理指定游戏（目录名，逗号分隔可多个——同跑共享段缓存省 API）")
    ap.add_argument("--only", help="只处理文件名含该子串的条目")
    args = ap.parse_args()

    manifest = build_manifest()
    if args.game:
        picked = [g.strip() for g in args.game.split(",") if g.strip()]
        unknown = [g for g in picked if g not in manifest]
        if unknown:
            sys.exit(f"未知游戏 {'、'.join(unknown)}，可选：{'、'.join(manifest)}")
        manifest = {g: manifest[g] for g in picked}

    # --check：manifest ↔ 磁盘双射核对
    ok = True
    for game, files in manifest.items():
        disk = {p.name for p in (GAMES / game / "audio").glob("*.mp3")}
        want = set(files)
        if disk != want:
            ok = False
            missing, extra = want - disk, disk - want
            if missing:
                print(f"[{game}] manifest 有、磁盘无: {sorted(missing)}")
            if extra:
                print(f"[{game}] 磁盘有、manifest 无: {sorted(extra)}")
    total = sum(len(f) for f in manifest.values())
    print(f"manifest 共 {total} 个文件，{'与磁盘一致 ✓' if ok else '与磁盘不一致 ✗'}")
    if args.check:
        return 0 if ok else 1

    # --trim：不调 API，原地裁磁盘现有文件的首尾静音（seq 文件中间留白不动）
    if args.trim:
        n = 0
        for game, files in manifest.items():
            for fname in files:
                if args.only and args.only not in fname:
                    continue
                p = GAMES / game / "audio" / fname
                if not p.is_file():
                    sys.exit(f"缺文件：{p}")
                trim_silence(p)
                n += 1
                print(f"  trim {game}/{fname}")
        print(f"----\n裁剪 {n} 个 mp3")
        return 0

    appid, key = load_credentials()
    seg_cache: dict[tuple[str, float], Path] = {}  # (文案, 语速) → 已合成段，跨游戏复用
    tmpdir = Path(tempfile.mkdtemp(prefix="cookie_tts_"))
    n_api = 0

    def seg_path(text: str, speed: float) -> Path:
        nonlocal n_api
        ck = (text, speed)
        if ck not in seg_cache:
            p = tmpdir / f"seg_{len(seg_cache):03d}.mp3"
            synth(text, speed, p, appid, key, silence_ms=50)
            n_api += 1
            seg_cache[ck] = p
        return seg_cache[ck]

    done = 0
    for game, files in manifest.items():
        out_dir = GAMES / game / "audio"
        out_dir.mkdir(parents=True, exist_ok=True)
        for fname, spec in files.items():
            if args.only and args.only not in fname:
                continue
            out = out_dir / fname
            kind = spec[0]
            if kind == "copy":
                src = GAMES / spec[1]
                if not src.is_file():
                    sys.exit(f"copy 源缺失：{src}（先生成 storybook 再跑 tw-summon）")
                shutil.copyfile(src, out)
            elif kind == "text":
                synth(spec[1], spec[2], out, appid, key)
                n_api += 1
            elif kind == "seq":
                paths = [seg_path(t, s) for t, s in (x for x in spec[1] if not isinstance(x, int))]
                stitch(spec[1], paths, out)
            if out.stat().st_size < 1024:
                sys.exit(f"产物异常（<1KB）：{out}")
            done += 1
            print(f"  {game}/{fname}")
    shutil.rmtree(tmpdir, ignore_errors=True)
    print(f"----\n生成 {done} 个 mp3，API 调用 {n_api} 次")
    return 0


if __name__ == "__main__":
    sys.exit(main())
