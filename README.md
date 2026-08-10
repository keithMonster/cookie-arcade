# Cookie's Arcade

A toddler-friendly mini-game collection for a (now 2-year-old) who started out smashing the keyboard. Single-file HTML per game, zero network, deployed on GitHub Pages.

## Live

https://keithmonster.github.io/cookie-arcade/

## Games (20)

| # | Name | What it does |
|---|---|---|
| 1 | **睡觉觉 Sleep Tight** | Tuck-in pretend play: a sleepy animal sways on its little bed, tap anywhere and the blanket pulls up to its chin — the sky turns to night, stars come out, a soft "嘘，晚安，小猫，做个好梦" plays over a three-note lullaby while 💤 drifts up. Extra taps float quiet stars instead of waking it. Then a gentle sunrise brings the next of 8 animals. The wind-down closer of the care trilogy (bath → feed → sleep), deliberately low-stimulation. |
| 2 | **洗澡澡 Bath Time** | Scrub-to-clean pretend play: an animal shows up mucky and gray with mud blobs, scrub (tap or drag) to pop them off with splashes and squeaks, and when the last one goes the animal brightens up, bounces and hears "哇！小狗洗得干干净净！". 8 animals, shuffled queue. |
| 3 | **喂一喂 Feed Me** | Food-matching pretend play: a big animal waits hungry over three food cards, but only its favorite gets eaten — tap it and it flies into its mouth with a heart burst ("小猫最爱吃小鱼啦！"). Tap a wrong food and the animal shakes its head, the card wobbles and a voice says "咦？我不爱吃这个呀！" — nothing is eaten. Three right bites and it's full — burp, celebration, next animal. 8 animals, each with a signature food. |
| 4 | **送回家 Shape Home** | Shape matching: a little house has a shape-shaped hole, a voice asks "圆形在哪里呀？", tap the right of two shape cards and it flies in and clicks into place. Wrong taps wobble + replay; after 2 misses the right card glows. Always ends in success. 6 shapes. |
| 5 | **谁在门后面 Storybook** | A knock-knock peekaboo picture book. The narrator asks "who's behind the door?", tap the door, it swings open and a Twirlywoo pops out — "哇！是蓝呼呼！" — then auto-flips to the next door. Ends with all four friends together + confetti. |
| 6 | **画彩虹 Scribble** | Drag a finger and it leaves a rainbow trail; lift and the canvas slowly clears. First continuous-creation game on the台. |
| 7 | **躲猫猫 Peekaboo** | Four candy blankets, a friend hiding under each. Lift a blanket and a friend pops out with confetti + "哇！是小猫！". After a beat the blanket drops back over a new friend. Blankets peek by themselves to say "someone's here!" — built for the object-permanence age. |
| 8 | **找一找 Find It** | Listen-and-point: a voice asks "X 在哪里呀?", tap the right one of three big cards. Wrong taps wobble + replay; after 2 misses the right card glows. Always ends in success. |
| 9 | **学说话 First Words** | Word-card machine: 50 Chinese words across 8 themes (family / fruit / food / body / nature / actions / everyday things / vehicles). Tap = the card says its word twice with a pause for imitation, then auto-flips. Deck shuffles every visit. |
| 10 | **车车 Cars** | Tap anywhere — a vehicle appears and drives off-screen with dust trails, name + sound. Emergency vehicles flash. |
| 11 | **动物园 Zoo** | 2×2 animal panels. Tap an animal to hear its name + cry; panels rotate through 17 animals. |
| 12-16 | **Twirlywoos × 5** | Summon birds / falling bubbles / four-bird chorus / mood colors / more-more-more ball pile — starring BigHoo, Toodloo, Chickedy & Chick on their red-boat stage. |
| 17 | **键盘小子 Keyboard Smash** | Each keypress spawns a shape + piano note + particles. Space = firework. |
| 18 | **戳泡泡 Pop Bubbles** | Bubbles drift up; hover / touch to pop. |
| 19 | **小鼓机 Drum Pad** | Keyboard rows = drums / cymbals / chimes. |
| 20 | **变色屏 Color Cascade** | Each key fades the screen to a new color with a soft note. Calming. |

## Navigation

- Tap a tile, press `1`–`9` for an exact game, or any other key for a random one
- Inside a game: `Esc` or the top-right corner returns home; `F` toggles fullscreen

## On iPad

Open the live URL in Safari → **Share → Add to Home Screen** for a full-screen standalone app. Everything responds to touch.

## Audio

All spoken voice follows one contract:

- Generate mp3 files at build time with Volcengine TTS V3, voice 灿灿 (`zh_female_cancan_uranus_bigtts`, mono 24kHz). The game never calls TTS at runtime, so it still works offline.
- `tools/gen-audio.py` is the single source of truth for voice settings and spoken copy. Add a new game's manifest there, run `python3 tools/gen-audio.py --game <game-directory>`, then run the same command with `--check` before committing. Credentials come from `DOUBAO_TTS_APP_ID` / `DOUBAO_TTS_ACCESS_KEY` or the local voice-reply skill fallback; never commit them.
- Do not use `SpeechSynthesis` for spoken Chinese: it has been silent on the target iPad and would break the shared voice. Web Audio remains appropriate for non-speech effects.
- For sequential or autoplay-follow-up speech on iOS, reuse one `Audio` element and swap `src`; `games/words/` is the reference implementation.

## Design

- [`CLAUDE.md`](CLAUDE.md) — the admission rules every new game has to pass (four questions + hard lines).
- [`WHY.md`](WHY.md) — why those rules exist: the toy→game axis, why "educational" and "fun" compete at this age, the capability map behind all 20 games, and the observable signals that will retire each hard line.
- [`STORY.md`](STORY.md) — how it all happened, written for Cookie to read someday.

## Inspirations

- [BabySmash](https://github.com/shanselman/babysmash) by Scott Hanselman
- [TinyFingers](https://tinyfingers.net/)
- [baby-bam-bam](https://github.com/bfritscher/baby-bam-bam)

## Structure

```
.
├── index.html              # arcade home (game picker)
├── games/
│   ├── _lib/               # Twirlywoos characters + stage + shared word data
│   ├── sleep/              # tuck-in bedtime (audio/ = pre-rendered mp3)
│   ├── bath/               # scrub-to-clean bath time (audio/ = pre-rendered mp3)
│   ├── feed/               # pretend feeding (audio/ = pre-rendered mp3)
│   ├── shapes/             # shape matching (audio/ = pre-rendered mp3)
│   ├── find/               # listen-and-point (audio/ = pre-rendered mp3)
│   ├── words/              # word cards (audio/ = pre-rendered mp3)
│   ├── cars/  animals/     # tap-to-spawn games (audio/ = pre-rendered mp3)
│   ├── tw-summon/ tw-bubbles/ tw-chorus/ tw-mood/ tw-more/
│   ├── peekaboo/ storybook/ scribble/
│   └── keyboard/ bubbles/ drums/ cascade/   # the original four, fully self-contained
└── tools/                  # offline audio generation (gen-audio.py, Volcengine TTS + ffmpeg)
```

v1 games are self-contained single files; the Twirlywoos five share `_lib/`, and words/find share one word list (`_lib/words-data.js`). `.nojekyll` keeps GitHub Pages from eating the `_lib` directory.

## The story

See [STORY.md](STORY.md) — written for Cookie to read someday.
