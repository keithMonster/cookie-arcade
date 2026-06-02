#!/usr/bin/env bash
# 为「学说话」(words) 词卡机离线生成发音 mp3。
# 范式同 animals/cars：避开 iOS SpeechSynthesis 整段被屏蔽（Keith iPad 实证），改预录 mp3。
# 每个词念两遍、中间 [[slnc 700]] 留 700ms 白——第一遍示范、留白给 Cookie 跟读、第二遍复读。
# 音色 Tingting（婷婷，legacy 隐藏音色，与 animals 一致）；mp3 单声道 22.05kHz 32kbps。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/words/audio
mkdir -p "$OUT"

# key|中文词——key 是 audio/<key>.mp3 文件名，词是要念的内容
WORDS=(
  # 家人
  "baba|爸爸"      "mama|妈妈"      "baobao|宝宝"    "yeye|爷爷"      "nainai|奶奶"
  # 水果
  "apple|苹果"     "banana|香蕉"    "strawberry|草莓" "grape|葡萄"    "orange|橘子"   "watermelon|西瓜"
  # 食物
  "rice|米饭"      "egg|鸡蛋"       "milk|牛奶"      "bread|面包"     "noodle|面条"   "biscuit|饼干"
  # 身体
  "eye|眼睛"       "ear|耳朵"       "nose|鼻子"      "mouth|嘴巴"     "hand|小手"     "foot|小脚"
  # 自然
  "sun|太阳"       "moon|月亮"      "star|星星"      "rainbow|彩虹"   "flower|花"     "rain|下雨"
)

tmp=$(mktemp -t words_gen).aiff
for entry in "${WORDS[@]}"; do
  key="${entry%%|*}"
  word="${entry##*|}"
  say -v Tingting "${word}[[slnc 700]]${word}" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/${key}.mp3"
  printf '  %-12s %s\n' "$key" "$word"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
