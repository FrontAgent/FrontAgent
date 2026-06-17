# FrontAgent HyperFrames Douyin Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 30-second 9:16 HyperFrames promo video project for FrontAgent and a matching Douyin marketing script/storyboard.

**Architecture:** Keep the work isolated from product runtime code. The marketing document owns copy, captions, and publishing metadata; the HyperFrames folder owns video source files, reusable styles, local assets, and render output. The rendered MP4 is treated as a local artifact because repository `.gitignore` already ignores `dist/`.

**Tech Stack:** Markdown, HTML, CSS keyframe animation, HyperFrames CLI via `npx hyperframes`, FFmpeg, GitNexus diff inspection.

---

## File Structure

- Create `docs/marketing/frontagent-douyin-video.md`
  - Owns final Chinese copy, narration, subtitle sequence, storyboard, Douyin title, description, and hashtags.
- Create `marketing/hyperframes/frontagent-douyin-promo/meta.json`
  - Owns project metadata, dimensions, fps, and duration.
- Create `marketing/hyperframes/frontagent-douyin-promo/index.html`
  - Owns the full 30-second root HyperFrames composition and all visual beats.
- Create `marketing/hyperframes/frontagent-douyin-promo/assets/icon.png`
  - Project-local copy of `assets/branding/icon.png` so the video project renders from its own directory.
- Create `marketing/hyperframes/frontagent-douyin-promo/README.md`
  - Owns local preview, lint, render, and verification commands.
- Generated local artifact: `marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4`
  - Do not commit unless maintainers explicitly approve committing generated binary output.

## Task 1: Marketing Script And Storyboard

**Files:**
- Create: `docs/marketing/frontagent-douyin-video.md`

- [ ] **Step 1: Create the marketing docs directory**

Run:

```bash
mkdir -p docs/marketing
```

Expected: command exits with status `0`.

- [ ] **Step 2: Write the Douyin video script**

Create `docs/marketing/frontagent-douyin-video.md` with these sections:

```markdown
# FrontAgent Douyin Promo Video

## Positioning

FrontAgent is an open-source frontend engineering agent. The video sells one idea: AI coding only becomes production-ready when the agent is constrained by specs, tools, repository knowledge, and quality gates.

## Target Viewer

Chinese-speaking frontend engineers, full-stack engineers, independent developers, and technical founders who have tried AI coding tools and hit hallucinated files, broken imports, context drift, or inconsistent project conventions.

## 30-Second Voiceover

AI 编程最大的问题，不是不会写代码。
是它会乱猜。

编不存在的路径，调不存在的 API，绕过你的工程规范。

FrontAgent 不是聊天式代码助手。
它是一个前端工程 Agent。

先用 SDD 定边界：技术栈、目录结构、禁止改动、质量规则。
再用 MCP 控制感知和执行：读文件、打补丁、看浏览器、跑校验。

交付前，先过 lint、typecheck、test。
失败就回到计划，重新修。

FrontAgent，把 AI 编程关进工程护栏。
开源可试。

## On-Screen Captions

1. AI 编程最大的问题
2. 不是不会写代码
3. 是它会乱猜
4. 不存在的路径
5. 不存在的 API
6. 绕过工程规范
7. FrontAgent
8. 前端工程 Agent
9. SDD 先定边界
10. MCP 控制感知与执行
11. 交付前跑门禁
12. 失败回到计划
13. 把 AI 编程关进工程护栏
14. GitHub: ceilf6/FrontAgent

## Storyboard

| Time | Beat | Visual | Caption |
| --- | --- | --- | --- |
| 0-3s | Hook | Broken paths, red terminal errors, unstable imports | AI 会乱猜 |
| 3-8s | Product reveal | FrontAgent logo resolves from code fragments | 前端工程 Agent |
| 8-15s | SDD | Blueprint panel locks project rules into place | 先有规格，再让 AI 动手 |
| 15-22s | MCP | Files, Browser, Shell, Git rails feed a protected pipeline | 不靠猜，靠工具确认 |
| 22-26s | Quality gates | Validation rows pass in sequence, with failed checks looping back to the plan | 过了门禁再交付 |
| 26-30s | CTA | Logo, repo name, npm install command | 开源可试 |

## Douyin Post Copy

AI 编程不是不能用，问题是不能让它乱猜。FrontAgent 用 SDD、MCP、浏览器感知、RAG 上下文和质量门禁，把前端 AI Agent 放进真实工程约束里。

## Titles

1. AI 编程真正缺的不是模型，是工程护栏
2. 让 AI 写前端代码前，先把边界定死
3. FrontAgent：面向真实工程的前端 AI Agent

## Hashtags

#AI编程 #前端开发 #开源项目 #MCP #Agent #TypeScript #程序员

## Production Notes

- Render as 9:16 vertical, 1080x1920, 30 fps.
- Keep captions large enough for mobile viewing.
- Do not bundle copyrighted music in the repository.
- Choose background music from Douyin's licensed music library after export.
```

Expected: the document exists and contains `## 30-Second Voiceover`.

- [ ] **Step 3: Verify the marketing document**

Run:

```bash
rg -n "FrontAgent|SDD|MCP|RAG|Douyin" docs/marketing/frontagent-douyin-video.md
```

Expected: output includes lines from the positioning, storyboard, and post copy sections.

## Task 2: HyperFrames Project Source

**Files:**
- Create: `marketing/hyperframes/frontagent-douyin-promo/meta.json`
- Create: `marketing/hyperframes/frontagent-douyin-promo/index.html`
- Create: `marketing/hyperframes/frontagent-douyin-promo/assets/icon.png`
- Create: `marketing/hyperframes/frontagent-douyin-promo/assets/bgm.m4a`
- Create: `marketing/hyperframes/frontagent-douyin-promo/assets/bgm-captions.vtt`
- Create: `marketing/hyperframes/frontagent-douyin-promo/README.md`

- [ ] **Step 1: Create project directories**

Run:

```bash
mkdir -p marketing/hyperframes/frontagent-douyin-promo/assets
```

Expected: command exits with status `0`.

- [ ] **Step 2: Copy the project-local logo asset**

Run:

```bash
cp assets/branding/icon.png marketing/hyperframes/frontagent-douyin-promo/assets/icon.png
```

Expected: `file marketing/hyperframes/frontagent-douyin-promo/assets/icon.png` reports `PNG image data`.

- [ ] **Step 3: Create HyperFrames metadata**

Create `marketing/hyperframes/frontagent-douyin-promo/meta.json`:

```json
{
  "name": "frontagent-douyin-promo",
  "id": "frontagent-douyin-promo",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 30,
  "entry": "index.html"
}
```

Expected: `node -e "JSON.parse(require('fs').readFileSync('marketing/hyperframes/frontagent-douyin-promo/meta.json','utf8')); console.log('ok')"` prints `ok`.

- [ ] **Step 4: Create the HTML composition**

Create `marketing/hyperframes/frontagent-douyin-promo/index.html` as one root composition with:

- `data-composition-id="frontagent-douyin-promo"`
- `data-width="1080"`
- `data-height="1920"`
- `data-duration="30"`
- six `.scene.clip` sections with `data-start` and `data-duration`
- CSS-only seek-safe visual design
- no external network assets
- project-local image reference `assets/icon.png`
- project-local audio reference `assets/bgm.m4a`
- project-local audio caption cue `assets/bgm-captions.vtt`

Required scene timing:

```text
hook: 0-3s
product: 3-8s
sdd: 8-15s
mcp: 15-22s
quality-gates: 22-26s
cta: 26-30s
```

Expected: the file contains `AI 会乱猜`, `SDD 先定边界`, `MCP 控制感知与执行`, `Quality Gates`, and `npm install -g frontagent`.

- [ ] **Step 5: Create the project README**

Create `marketing/hyperframes/frontagent-douyin-promo/README.md`:

```markdown
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

Run commands from this directory:

```bash
cd marketing/hyperframes/frontagent-douyin-promo
```

The rendered MP4 is a local artifact under `dist/`. Repository `.gitignore` ignores `dist/`, so the MP4 is not committed by default.
```

Expected: the README includes `npx hyperframes render --output dist/frontagent-douyin-promo.mp4`.

- [ ] **Step 6: Verify source files**

Run:

```bash
rg -n "data-composition-id|data-duration|AI 会乱猜|GitHub: ceilf6/FrontAgent" marketing/hyperframes/frontagent-douyin-promo
```

Expected: output includes matches from `index.html`.

## Task 3: Local HyperFrames Validation And Render

**Files:**
- Read: `marketing/hyperframes/frontagent-douyin-promo/index.html`
- Generated: `marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4`

- [ ] **Step 1: Check runtime dependencies**

Run:

```bash
node --version
ffmpeg -version | head -n 1
```

Expected:

- Node.js major version is `v22` or newer.
- FFmpeg prints a version line.

If Node.js is older than 22 or FFmpeg is missing, record the exact output and skip render while keeping source files complete.

- [ ] **Step 2: Run HyperFrames lint**

Run:

```bash
cd marketing/hyperframes/frontagent-douyin-promo && npx hyperframes lint
```

Expected: command exits with status `0`, or prints actionable composition issues to fix.

- [ ] **Step 3: Render the MP4**

Run:

```bash
cd marketing/hyperframes/frontagent-douyin-promo && npx hyperframes render --output dist/frontagent-douyin-promo.mp4
```

Expected: command exits with status `0` and creates `dist/frontagent-douyin-promo.mp4`.

- [ ] **Step 4: Inspect media properties**

Run:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of default=noprint_wrappers=1 marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4
```

Expected:

- `width=1080`
- `height=1920`
- `r_frame_rate=30/1`
- duration is approximately `30` seconds

- [ ] **Step 5: Capture representative frames**

Run:

```bash
mkdir -p marketing/hyperframes/frontagent-douyin-promo/dist/frames
ffmpeg -y -ss 1 -i marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4 -frames:v 1 marketing/hyperframes/frontagent-douyin-promo/dist/frames/hook.png
ffmpeg -y -ss 16 -i marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4 -frames:v 1 marketing/hyperframes/frontagent-douyin-promo/dist/frames/mcp.png
ffmpeg -y -ss 28 -i marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4 -frames:v 1 marketing/hyperframes/frontagent-douyin-promo/dist/frames/cta.png
```

Expected: three PNG frame captures exist and are non-empty. Visually inspect them before finalizing.

## Task 4: Repository Checks And Commit

**Files:**
- Stage: `docs/marketing/frontagent-douyin-video.md`
- Stage: `marketing/hyperframes/frontagent-douyin-promo/meta.json`
- Stage: `marketing/hyperframes/frontagent-douyin-promo/index.html`
- Stage: `marketing/hyperframes/frontagent-douyin-promo/assets/icon.png`
- Stage: `marketing/hyperframes/frontagent-douyin-promo/README.md`
- Do not stage: `.gitnexus/lbug`
- Do not stage: `.gitnexus/meta.json`
- Do not stage: `marketing/hyperframes/frontagent-douyin-promo/dist/`

- [ ] **Step 1: Inspect working tree**

Run:

```bash
git status --short
```

Expected: source files are untracked or modified; `.gitnexus/lbug` and `.gitnexus/meta.json` may remain modified and must not be staged.

- [ ] **Step 2: Run GitNexus change detection before staging**

Run via MCP:

```text
detect_changes(repo="FrontAgent", scope="unstaged")
```

Expected: marketing/docs files show no code-symbol blast radius or only low-risk file additions.

- [ ] **Step 3: Stage only source deliverables**

Run:

```bash
git add docs/marketing/frontagent-douyin-video.md \
  marketing/hyperframes/frontagent-douyin-promo/meta.json \
  marketing/hyperframes/frontagent-douyin-promo/index.html \
  marketing/hyperframes/frontagent-douyin-promo/assets/icon.png \
  marketing/hyperframes/frontagent-douyin-promo/README.md
```

Expected: `git diff --cached --name-status` lists exactly those five paths.

- [ ] **Step 4: Run GitNexus change detection on staged diff**

Run via MCP:

```text
detect_changes(repo="FrontAgent", scope="staged")
```

Expected: low risk, no runtime execution flows affected.

- [ ] **Step 5: Commit implementation source**

Run:

```bash
git commit -m "docs: add FrontAgent HyperFrames Douyin promo"
```

Expected: commit succeeds. If pre-commit runs full quality gates, record the result. If it fails on unrelated existing lint info, report the exact failure before changing unrelated code.

## Self-Review Checklist

- The plan covers the approved spec deliverables: marketing script, HyperFrames source project, local logo asset, render attempt, and GitNexus final diff check.
- The plan avoids runtime FrontAgent code changes.
- The plan keeps generated MP4 output local because `dist/` is ignored.
- The plan names exact files and commands.
- The plan includes fallback behavior for missing Node.js 22 or FFmpeg.
