#!/usr/bin/env bash
# 为「送回家」(shapes) 形状配对游戏离线生成发音 mp3。
# 每个形状两条：q_<key>.mp3 = 问题「<形状>的家！<形状>在哪里呀？」/ y_<key>.mp3 = 表扬「对啦！<形状>回家啦！」
# 音色 Tingting（婷婷，与 find/words/animals 一致）；mp3 单声道 22.05kHz 32kbps。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/shapes/audio
mkdir -p "$OUT"

# key|中文形状名——与 games/shapes/index.html SHAPES 同源
SHAPES=(
  "circle|圆形"
  "square|方形"
  "triangle|三角形"
  "star|星星"
  "heart|爱心"
  "moon|月亮"
)

tmp=$(mktemp -t shapes_gen).aiff
for entry in "${SHAPES[@]}"; do
  key="${entry%%|*}"
  word="${entry##*|}"
  say -v Tingting "${word}的家！[[slnc 300]]${word}在哪里呀？" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/q_${key}.mp3"
  say -v Tingting "对啦！[[slnc 300]]${word}回家啦！" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/y_${key}.mp3"
  printf '  %-10s %s\n' "$key" "$word"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
