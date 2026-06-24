#!/usr/bin/env bash
# 为「躲猫猫」(peekaboo) 掀盖找朋友游戏离线生成发音 mp3。
# 每个角色一条：<key>.mp3 = 惊喜揭晓「哇！是<名字>！」
# 躲猫猫的核心是「期待→惊喜」，所以语音用感叹的「哇！」开场 + 命名（顺带强化词汇）。
# 音色 Tingting（婷婷，与 words/animals/find 一致）；mp3 单声道 22.05kHz 32kbps。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/peekaboo/audio
mkdir -p "$OUT"

# key|中文名——角色池（动物萌物，emoji 在 index.html 里）
CHARS=(
  "cat|小猫"      "dog|小狗"      "rabbit|小兔子"  "cow|奶牛"
  "frog|青蛙"     "tiger|老虎"    "monkey|猴子"    "penguin|企鹅"
  "chick|小鸡"    "fox|狐狸"      "panda|熊猫"     "bear|小熊"
)

tmp=$(mktemp -t peekaboo_gen).aiff
for entry in "${CHARS[@]}"; do
  key="${entry%%|*}"
  name="${entry##*|}"
  say -v Tingting "哇！[[slnc 150]]是${name}！" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/${key}.mp3"
  printf '  %-10s %s\n' "$key" "$name"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
