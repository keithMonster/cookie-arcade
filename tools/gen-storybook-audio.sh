#!/usr/bin/env bash
# 为「谁在门后面？」(storybook) 敲门躲猫猫交互绘本离线生成旁白 mp3。
# 正式版换掉 MVP 的 SpeechSynthesis（iOS Safari 屏蔽中文语音，v0.9 已实证），统一走预录 mp3。
# 音色 Tingting（婷婷，与 words/animals/find/peekaboo 一致）；mp3 单声道 22.05kHz 32kbps。
# 三类台词：① intro 开场 ② ask_N 每扇门的问句（念完门晃动提示可戳）③ reveal_<角色> 门开揭晓 ④ finale 结尾。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/storybook/audio
mkdir -p "$OUT"

# key|台词——揭晓沿用 peekaboo「哇！是X！」惊喜范式 + 角色叫声尾缀
LINES=(
  "intro|我们来玩躲猫猫吧！"
  "ask_1|咚咚咚，[[slnc 150]]谁在门后面呀？"
  "ask_2|这扇门后面，[[slnc 150]]又是谁呢？"
  "ask_3|听，[[slnc 150]]里面有声音！谁呀？"
  "ask_4|最后一扇门，[[slnc 150]]敲一敲！"
  "reveal_bighoo|哇！[[slnc 150]]是蓝呼呼！[[slnc 200]]呼——"
  "reveal_toodloo|哇！[[slnc 150]]是红涂涂！[[slnc 200]]涂——"
  "reveal_chickedy|哇！[[slnc 150]]是唧唧！[[slnc 200]]唧唧唧"
  "reveal_chick|哇！[[slnc 150]]是啾啾！[[slnc 200]]啾啾"
  "finale|找到所有的呼呼啦！"
)

tmp=$(mktemp -t storybook_gen).aiff
for entry in "${LINES[@]}"; do
  key="${entry%%|*}"
  text="${entry##*|}"
  say -v Tingting "$text" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/${key}.mp3"
  printf '  %-16s %s\n' "$key" "$text"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
