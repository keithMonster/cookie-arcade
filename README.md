# Cookie's Arcade

A toddler-friendly mini-game collection for a (now almost 2-year-old) who started out smashing the keyboard. Single-file HTML per game, zero network, deployed on GitHub Pages.

## Live

https://keithmonster.github.io/cookie-arcade/

## Games (13)

| # | Name | What it does |
|---|---|---|
| 1 | **找一找 Find It** | Listen-and-point: a voice asks "X 在哪里呀?", tap the right one of two big cards. Wrong taps wobble + replay; after 2 misses the right card glows. Always ends in success. |
| 2 | **学说话 First Words** | Word-card machine: 29 Chinese words across 5 themes (family / fruit / food / body / nature). Tap = the card says its word twice with a pause for imitation, then auto-flips. Deck shuffles every visit. |
| 3 | **车车 Cars** | Tap anywhere — a vehicle appears and drives off-screen with dust trails, name + sound. Emergency vehicles flash. |
| 4 | **动物园 Zoo** | 2×2 animal panels. Tap an animal to hear its name + cry; panels rotate through 17 animals. |
| 5-9 | **Twirlywoos × 5** | Summon birds / falling bubbles / four-bird chorus / mood colors / more-more-more ball pile — starring BigHoo, Toodloo, Chickedy & Chick on their red-boat stage. |
| 10 | **键盘小子 Keyboard Smash** | Each keypress spawns a shape + piano note + particles. Space = firework. |
| 11 | **戳泡泡 Pop Bubbles** | Bubbles drift up; hover / touch to pop. |
| 12 | **小鼓机 Drum Pad** | Keyboard rows = drums / cymbals / chimes. |
| 13 | **变色屏 Color Cascade** | Each key fades the screen to a new color with a soft note. Calming. |

## Navigation

- Tap a tile, press `1`–`9` for an exact game, or any other key for a random one
- Inside a game: `Esc` or the top-right corner returns home; `F` toggles fullscreen

## On iPad

Open the live URL in Safari → **Share → Add to Home Screen** for a full-screen standalone app. Everything responds to touch.

## Audio

Speech audio is pre-rendered mp3 (macOS `say -v Tingting`, mono 22.05kHz 32kbps) because iOS WebKit blocks SpeechSynthesis entirely. Regenerate with the scripts in `tools/`.

## Inspirations

- [BabySmash](https://github.com/shanselman/babysmash) by Scott Hanselman
- [TinyFingers](https://tinyfingers.net/)
- [baby-bam-bam](https://github.com/bfritscher/baby-bam-bam)

## Structure

```
.
├── index.html              # arcade home (game picker)
├── games/
│   ├── _lib/               # Twirlywoos characters + stage (shared by tw-*)
│   ├── find/               # listen-and-point (audio/ = 58 pre-rendered mp3)
│   ├── words/              # word cards (audio/ = 29 pre-rendered mp3)
│   ├── cars/  animals/     # tap-to-spawn games (audio/ = pre-rendered mp3)
│   ├── tw-summon/ tw-bubbles/ tw-chorus/ tw-mood/ tw-more/
│   └── keyboard/ bubbles/ drums/ cascade/   # the original four, fully self-contained
└── tools/                  # offline audio generation scripts (say + lame)
```

v1 games are self-contained single files; the Twirlywoos five share `_lib/`. `.nojekyll` keeps GitHub Pages from eating the `_lib` directory.

## The story

See [STORY.md](STORY.md) — written for Cookie to read someday.
