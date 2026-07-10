// 词库单一数据源：words（学说话）与 find（找一找）共享。
// 扩容 2026-07-10：29→50 词，新增动作/日用/交通三主题（Cookie 24 月龄词汇爆发期）。
// 修改词表后需重跑 tools/gen-words-audio.sh 与 tools/gen-find-audio.sh 重新生成音频。
// 字段：emoji 大图 + word 中文词 + key（audio 文件名）+ theme（主题索引，决定背景色）。
// 按主题分组排列：同主题词连续出现形成语义聚类；家人放第一组（情感优先）；🍪饼干 = Cookie 名字双关。
const WORDS_DATA = [
  // 家人 theme 0
  { emoji: '👨', word: '爸爸', key: 'baba',   theme: 0 },
  { emoji: '👩', word: '妈妈', key: 'mama',   theme: 0 },
  { emoji: '👶', word: '宝宝', key: 'baobao', theme: 0 },
  { emoji: '👴', word: '爷爷', key: 'yeye',   theme: 0 },
  { emoji: '👵', word: '奶奶', key: 'nainai', theme: 0 },
  // 水果 theme 1
  { emoji: '🍎', word: '苹果', key: 'apple',      theme: 1 },
  { emoji: '🍌', word: '香蕉', key: 'banana',     theme: 1 },
  { emoji: '🍓', word: '草莓', key: 'strawberry', theme: 1 },
  { emoji: '🍇', word: '葡萄', key: 'grape',      theme: 1 },
  { emoji: '🍊', word: '橘子', key: 'orange',     theme: 1 },
  { emoji: '🍉', word: '西瓜', key: 'watermelon', theme: 1 },
  // 食物 theme 2
  { emoji: '🍚', word: '米饭', key: 'rice',    theme: 2 },
  { emoji: '🥚', word: '鸡蛋', key: 'egg',     theme: 2 },
  { emoji: '🥛', word: '牛奶', key: 'milk',    theme: 2 },
  { emoji: '🍞', word: '面包', key: 'bread',   theme: 2 },
  { emoji: '🍜', word: '面条', key: 'noodle',  theme: 2 },
  { emoji: '🍪', word: '饼干', key: 'biscuit', theme: 2 },
  // 身体 theme 3
  { emoji: '👀', word: '眼睛', key: 'eye',   theme: 3 },
  { emoji: '👂', word: '耳朵', key: 'ear',   theme: 3 },
  { emoji: '👃', word: '鼻子', key: 'nose',  theme: 3 },
  { emoji: '👄', word: '嘴巴', key: 'mouth', theme: 3 },
  { emoji: '✋', word: '小手', key: 'hand',  theme: 3 },
  { emoji: '🦶', word: '小脚', key: 'foot',  theme: 3 },
  // 自然 theme 4
  { emoji: '☀️', word: '太阳', key: 'sun',     theme: 4 },
  { emoji: '🌙', word: '月亮', key: 'moon',    theme: 4 },
  { emoji: '⭐', word: '星星', key: 'star',    theme: 4 },
  { emoji: '🌈', word: '彩虹', key: 'rainbow', theme: 4 },
  { emoji: '🌸', word: '花',   key: 'flower',  theme: 4 },
  { emoji: '🌧️', word: '下雨', key: 'rain',    theme: 4 },
  { emoji: '☁️', word: '云朵', key: 'cloud',   theme: 4 },
  { emoji: '⛄', word: '雪人', key: 'snowman', theme: 4 },
  { emoji: '🌳', word: '大树', key: 'tree',    theme: 4 },
  // 动作 theme 5
  { emoji: '🤗', word: '抱抱', key: 'hug',   theme: 5 },
  { emoji: '👏', word: '拍手', key: 'clap',  theme: 5 },
  { emoji: '😴', word: '睡觉', key: 'sleep', theme: 5 },
  { emoji: '🛁', word: '洗澡', key: 'bath',  theme: 5 },
  { emoji: '😄', word: '笑笑', key: 'laugh', theme: 5 },
  { emoji: '😢', word: '哭哭', key: 'cry',   theme: 5 },
  // 日用 theme 6
  { emoji: '🧢', word: '帽子', key: 'hat',      theme: 6 },
  { emoji: '👟', word: '鞋子', key: 'shoe',     theme: 6 },
  { emoji: '🧦', word: '袜子', key: 'sock',     theme: 6 },
  { emoji: '🥄', word: '勺子', key: 'spoon',    theme: 6 },
  { emoji: '⚽', word: '皮球', key: 'ball',     theme: 6 },
  { emoji: '📖', word: '书本', key: 'book',     theme: 6 },
  { emoji: '☂️', word: '雨伞', key: 'umbrella', theme: 6 },
  { emoji: '💡', word: '灯',   key: 'lamp',     theme: 6 },
  // 交通 theme 7
  { emoji: '🚗', word: '汽车', key: 'car',   theme: 7 },
  { emoji: '✈️', word: '飞机', key: 'plane', theme: 7 },
  { emoji: '⛵', word: '小船', key: 'boat',  theme: 7 },
  { emoji: '🚂', word: '火车', key: 'train', theme: 7 },
];
// 主题主色（柔和糖果色，互相区分）——索引对应 theme 字段，走 background-color 以便平滑过渡
const WORDS_THEMES = ['#ffc4d2', '#ffae86', '#ffd86b', '#a8dcc0', '#9ec8f0', '#d8c9f0', '#a8e0d8', '#ffd8b0'];
