#!/usr/bin/env bash
# 为「找一找」(find) 听音指认游戏离线生成发音 mp3。
# 每个词两条：q_<key>.mp3 = 问题「<词>在哪里呀？」/ y_<key>.mp3 = 表扬「对啦！<词>、<词>！」
# 表扬里把词再念两遍（中间留白）——答对的瞬间是跟读意愿最强的时刻，借势强化。
# 音色 Tingting（婷婷，与 words/animals 一致）；mp3 单声道 22.05kHz 32kbps。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/find/audio
mkdir -p "$OUT"

# key|中文词——与 games/_lib/words-data.js 同源（50 词），改词表两处一起改
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
  "cloud|云朵"     "snowman|雪人"   "tree|大树"
  # 动作（2026-07-10 扩容，24 月龄词汇爆发期）
  "hug|抱抱"       "clap|拍手"      "sleep|睡觉"     "bath|洗澡"      "laugh|笑笑"    "cry|哭哭"
  # 日用
  "hat|帽子"       "shoe|鞋子"      "sock|袜子"      "spoon|勺子"     "ball|皮球"     "book|书本"     "umbrella|雨伞" "lamp|灯"
  # 交通
  "car|汽车"       "plane|飞机"     "boat|小船"      "train|火车"
)

tmp=$(mktemp -t find_gen).aiff
for entry in "${WORDS[@]}"; do
  key="${entry%%|*}"
  word="${entry##*|}"
  say -v Tingting "${word}在哪里呀？" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/q_${key}.mp3"
  say -v Tingting "对啦！[[slnc 300]]${word}[[slnc 600]]${word}" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/y_${key}.mp3"
  printf '  %-12s %s\n' "$key" "$word"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
