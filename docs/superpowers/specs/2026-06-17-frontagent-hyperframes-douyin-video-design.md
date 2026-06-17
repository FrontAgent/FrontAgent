# FrontAgent HyperFrames Douyin Promo Video Design

Date: 2026-06-17
Branch: `feature/hyperframes-video`
Status: Approved for implementation planning

## Summary

Create a 30-second vertical Douyin promo video for FrontAgent using HyperFrames. The video should position FrontAgent as an open-source frontend engineering agent that turns AI coding from uncontrolled guessing into a constrained, inspectable engineering workflow.

The work has two deliverables:

- A marketing script and storyboard document at `docs/marketing/frontagent-douyin-video.md`.
- A HyperFrames video project at `marketing/hyperframes/frontagent-douyin-promo/`, rendering to `marketing/hyperframes/frontagent-douyin-promo/dist/frontagent-douyin-promo.mp4`.

## Audience And Goal

The target audience is Chinese-speaking frontend engineers, full-stack engineers, independent developers, and technical founders browsing Douyin. They may already know AI coding tools, but they are skeptical because generated code often invents paths, ignores project rules, or fails after one error.

The video should make one idea memorable:

> AI coding is useful only when it is constrained by real engineering context. FrontAgent adds SDD, MCP, browser awareness, repository memory, and quality gates around the agent loop.

The expected viewer action is to remember the project name and visit GitHub, npm, or the README later. The video is not expected to explain every feature or prove every benchmark.

## Chosen Approach

Use a 9:16, 1080x1920, 30 fps, approximately 30-second kinetic technical explainer.

This approach was selected over a longer product explainer or live demo recording because Douyin rewards immediate hooks, short beats, strong captions, and a single sharp takeaway. A first version should sell the positioning before trying to show a full terminal workflow.

## Source Positioning

The creative direction is based on the existing repository materials:

- `README.md` and `docs/README-CN.md`: FrontAgent is an open-source frontend AI coding agent with CLI, VS Code, Desktop, MCP server, RAG planning, browser-aware automation, SDD guardrails, self-healing, and quality gates.
- `docs/FrontAgent-Introduction.md`: the main product pain points are hallucinated paths and APIs, context drift, weak error recovery, weak engineering constraints, and brittle JSON planning.
- `docs/design.md` and `docs/architecture.md`: the core technical thesis is SDD as a hard control layer, MCP as the trusted interface, and hallucination prevention through planning, execution, validation, and memory layers.

HyperFrames implementation assumptions are based on the official HyperFrames README and quickstart:

- HyperFrames turns HTML, CSS, media, and seekable animations into deterministic MP4 output.
- Local projects can be scaffolded and run with `npx hyperframes init`, `npx hyperframes preview`, `npx hyperframes lint`, and `npx hyperframes render`.
- Local rendering requires Node.js 22+ and FFmpeg.
- HyperFrames compositions are HTML-native and use `data-*` attributes for timed clips and tracks, with seekable animation support through CSS, GSAP, Lottie, Three.js, Anime.js, WAAPI, or custom adapters.

## Video Format

- Platform: Douyin
- Aspect ratio: 9:16 vertical
- Resolution: 1080x1920
- Frame rate: 30 fps
- Duration: 30 seconds target, with a tolerance of plus or minus 1 second
- Language: Simplified Chinese
- Audio: no bundled copyrighted background music in the repository; use silent render or simple generated non-copyright click/sweep effects if practical. Background music can be chosen inside Douyin after export.
- Voiceover: optional. The first implementation may rely on large captions and motion instead of generated voiceover to avoid TTS quality and licensing issues.

## Narrative Structure

### Beat 1: Hook, 0-3s

Message: "AI 编程最大的问题，不是不会写代码。是它会乱猜。"

Visuals:

- Fast glitch-style stack of fake broken file paths, red terminal errors, and crossed-out package imports.
- Big center caption: "AI 会乱猜"
- Small supporting terms: "不存在的文件", "错误路径", "绕过规范"

Purpose: stop scroll immediately with a familiar pain.

### Beat 2: Reframe, 3-8s

Message: "FrontAgent 不是聊天式代码助手，而是前端工程 Agent。"

Visuals:

- FrontAgent logo resolves from noisy terminal fragments.
- Three labeled surfaces orbit or slide in: CLI, VS Code, Desktop.
- Caption: "前端工程 Agent"

Purpose: establish category and product name.

### Beat 3: Control Layer, 8-15s

Message: "SDD 先定边界：技术栈、目录结构、禁止改动、质量规则。"

Visuals:

- A blueprint-like SDD panel drops over the chaotic code.
- Tokens lock into place: `tech_stack`, `module_boundaries`, `protected_files`, `quality_gates`.
- Caption: "先有规格，再让 AI 动手"

Purpose: communicate why FrontAgent differs from prompt-only tools.

### Beat 4: Trusted Execution, 15-22s

Message: "MCP 让感知和执行可控：读文件、打补丁、看浏览器、跑校验。"

Visuals:

- Four tool rails animate into a protected pipeline: Files, Browser, Shell, Git.
- A browser card shows a simplified accessibility tree rather than a generic screenshot.
- Caption: "不靠猜，靠工具确认"

Purpose: connect MCP to practical engineering reliability.

### Beat 5: Repository Intelligence, 22-26s

Message: "GitNexus 和质量门禁检查影响面，避免一改全崩。"

Visuals:

- Dependency graph lights up from one changed node.
- Quality gate indicators switch from pending to pass.
- Caption: "改之前看影响，交付前跑门禁"

Purpose: show production workflow credibility.

### Beat 6: Call To Action, 26-30s

Message: "FrontAgent：把 AI 编程关进工程护栏。开源可试。"

Visuals:

- Final lockup with logo, GitHub URL text, npm package name, and short command `npm install -g frontagent`.
- Caption: "开源前端工程 Agent"

Purpose: leave one product phrase and one action.

## On-Screen Copy

Primary caption sequence:

1. AI 编程最大的问题
2. 不是不会写代码
3. 是它会乱猜
4. FrontAgent
5. 前端工程 Agent
6. SDD 先定边界
7. MCP 控制感知与执行
8. 浏览器感知 + 最小补丁 + 质量门禁
9. 改之前看影响
10. 交付前跑校验
11. 把 AI 编程关进工程护栏
12. GitHub: ceilf6/FrontAgent

The captions should be short and punchy. They must not cover the CTA or logo in the final 4 seconds.

## Visual Direction

The visual tone should be technical, sharp, and controlled. Avoid generic cyberpunk neon, oversized gradients, or decorative blobs. The design should look like a serious frontend engineering tool translated into a social video.

Recommended palette:

- Background: near-black charcoal, `#0b0f14`
- Primary accent: FrontAgent cyan/blue sampled or approximated from `assets/branding/icon.png`
- Reliability accent: green for passed checks
- Risk accent: red only for the opening broken-state hook
- Text: white and cool gray

Typography:

- Use system Chinese sans-serif fallback stacks for broad rendering reliability.
- Use large, high-contrast captions with stable safe margins for Douyin UI overlays.
- Avoid small paragraphs. Use short labels and code-like tokens.

Motion:

- Fast cuts in the first 3 seconds.
- Snap-to-grid transitions for SDD and MCP beats.
- Smooth graph illumination for GitNexus beat.
- Final CTA should hold long enough to read.

## HyperFrames Project Design

The implementation should create a self-contained HyperFrames project:

```text
marketing/hyperframes/frontagent-douyin-promo/
  meta.json
  index.html
  compositions/
    01-hook.html
    02-product.html
    03-sdd.html
    04-mcp.html
    05-gitnexus.html
    06-cta.html
  assets/
    icon.png
  dist/
    frontagent-douyin-promo.mp4
```

The root `index.html` should orchestrate the six beats as timed sub-compositions. Each sub-composition should be understandable on its own, with one visual responsibility and one section of copy.

The project should copy or reference `assets/branding/icon.png` in a way that keeps the video project portable. Referencing the existing source asset is acceptable during development, but the final project should include its own `assets/icon.png` copy so rendering works from the project directory.

## Animation Architecture

Use plain HTML/CSS for the first implementation unless a specific beat clearly requires GSAP. CSS keyframes and HyperFrames timing attributes should be enough for:

- Broken-code glitch text
- Logo reveal
- SDD blueprint cards
- MCP tool rails
- Dependency graph pulses
- CTA lockup

If GSAP is used, the timeline must be paused and registered for deterministic seekable rendering according to HyperFrames expectations. Avoid wall-clock-only animations that could preview differently from rendered frames.

## Data And Asset Flow

Input assets:

- `assets/branding/icon.png`
- Existing README and docs for accurate product copy

Generated assets:

- `docs/marketing/frontagent-douyin-video.md`
- HyperFrames HTML/CSS files
- Project-local `assets/icon.png`
- Rendered MP4 in `dist/`

No generated binary should be committed until size and repository policy are checked. If the MP4 is large, keep it as a local artifact and commit only the source project plus docs.

## Error Handling

Implementation should handle common local setup failures explicitly:

- If Node.js is older than 22, report that HyperFrames cannot render locally and leave the project source ready.
- If FFmpeg is missing, report that preview/lint may work but render cannot complete locally.
- If `npx hyperframes` fails due to network or package resolution, keep the manually authored project files and document the exact command failure.
- If rendering succeeds but visual inspection shows blank or misframed output, iterate before claiming completion.

## Verification Plan

Minimum verification before implementation is considered complete:

1. Check Node.js and FFmpeg availability.
2. Run HyperFrames lint if available.
3. Run HyperFrames preview or an equivalent static composition inspection.
4. Render a draft or final MP4 with HyperFrames.
5. Inspect the video output or at least capture representative frames at the hook, midpoint, and CTA.
6. Confirm the video is vertical 1080x1920, approximately 30 seconds, and nonblank.
7. Run GitNexus `detect_changes` before committing implementation work.

Repository-wide gates such as `pnpm quality:precommit` should be run before final review when feasible. If they are skipped because the work is marketing-only or the environment lacks video dependencies, the reason must be stated.

## Non-Goals

- Do not add new product features to FrontAgent.
- Do not modify runtime agent, CLI, VS Code, desktop, MCP, or GitNexus code.
- Do not add comment-triggered automation, training-camp workflow claims, score labels, or OSS workflow changes.
- Do not bundle copyrighted music or third-party media without a clear license.
- Do not make a long-form Bilibili explainer in this first version.
- Do not depend on a live website or external API at render time.

## Acceptance Criteria

The work is complete when:

- The marketing script and storyboard exist in `docs/marketing/frontagent-douyin-video.md`.
- The HyperFrames source project exists in `marketing/hyperframes/frontagent-douyin-promo/`.
- A local render command has been attempted and its result is reported.
- If rendering succeeds, the MP4 path and basic media properties are reported.
- If rendering cannot complete locally, the source project remains runnable and the missing dependency or command failure is documented.
- Existing `.gitnexus` working tree changes are not reverted, staged, or committed unless explicitly requested by the maintainer.

