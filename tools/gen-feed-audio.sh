#!/usr/bin/env bash
# 为「喂一喂」(feed) 假装喂食游戏离线生成发音 mp3。
# 每只动物两条：fav_<key>.mp3 = 喂到最爱「哇！<动物>最爱吃<食物>啦！」/ full_<key>.mp3 = 吃饱「嗝！<动物>吃饱啦！」
# 另有 3 条通用咀嚼反馈 yum_1/2/3（普通食物轮换播，避免单句听腻）。
# 音色 Tingting（婷婷，与 find/words/animals 一致）；mp3 单声道 22.05kHz 32kbps。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=games/feed/audio
mkdir -p "$OUT"

# key|动物名|最爱食物名——与 games/feed/index.html PETS/FOODS 同源
PETS=(
  "cat|小猫|小鱼"
  "dog|小狗|骨头"
  "rabbit|兔子|胡萝卜"
  "monkey|猴子|香蕉"
  "panda|熊猫|竹子"
  "cow|奶牛|青草"
  "chicken|母鸡|玉米"
  "elephant|大象|苹果"
)

tmp=$(mktemp -t feed_gen).aiff
for entry in "${PETS[@]}"; do
  key="$(echo "$entry" | cut -d'|' -f1)"
  name="$(echo "$entry" | cut -d'|' -f2)"
  food="$(echo "$entry" | cut -d'|' -f3)"
  say -v Tingting "哇！[[slnc 200]]${name}最爱吃${food}啦！" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/fav_${key}.mp3"
  say -v Tingting "嗝！[[slnc 300]]${name}吃饱啦！" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/full_${key}.mp3"
  printf '  %-10s %s（%s）\n' "$key" "$name" "$food"
done

# 通用咀嚼反馈 3 条
YUMS=(
  "yum_1|啊呜！真好吃！"
  "yum_2|啊呜啊呜，好吃好吃！"
  "yum_3|哇哦，太好吃啦！"
)
for entry in "${YUMS[@]}"; do
  key="${entry%%|*}"
  text="${entry##*|}"
  say -v Tingting "$text" -o "$tmp"
  lame --quiet -m m --resample 22.05 -b 32 "$tmp" "$OUT/${key}.mp3"
  printf '  %-10s %s\n' "$key" "$text"
done
rm -f "$tmp"

echo "----"
echo "生成完毕：$(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') 个 mp3 → $OUT"
du -sh "$OUT"
