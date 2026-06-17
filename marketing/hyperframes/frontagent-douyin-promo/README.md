# FrontAgent Douyin Promo HyperFrames Project

Source for the 30-second vertical FrontAgent Douyin promo video.

## Requirements

- Node.js 22+
- FFmpeg
- Network access for `npx hyperframes` on first run

## Commands

```bash
npx hyperframes lint
npx hyperframes preview
npx hyperframes render --output dist/frontagent-douyin-promo.mp4
```

The composition includes an original local BGM asset at `assets/bgm.m4a`; HyperFrames should render it into the MP4 audio track. `assets/bgm-captions.vtt` provides the required media caption cue for the background music.

Run commands from this directory:

```bash
cd marketing/hyperframes/frontagent-douyin-promo
```

The rendered MP4 is a local artifact under `dist/`. Repository `.gitignore` ignores `dist/`, so the MP4 is not committed by default.
