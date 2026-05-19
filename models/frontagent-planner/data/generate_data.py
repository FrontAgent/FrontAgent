"""
FrontAgent Planner v2 data generator.

The v2 dataset pipeline is quality-gated before samples are written:
- action must be one of the runtime planner actions
- all template placeholders must be resolved
- stepOutlines must contain description/action/phase
- risks and alternatives must be non-empty lists

The default path is offline deterministic generation so the repository can
rebuild train_v2/eval_v2 without an external model. Use --mode teacher when a
teacher API is available.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import time
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = SCRIPT_DIR.parent / "prompts"
SCHEMA_PATH = PROMPTS_DIR / "schema.json"

DEFAULT_ALLOWED_ACTIONS = {
    "read_file",
    "list_directory",
    "create_file",
    "apply_patch",
    "search_code",
    "get_ast",
    "run_command",
    "browser_navigate",
    "get_page_structure",
    "browser_click",
    "browser_type",
    "browser_screenshot",
}


def load_allowed_actions() -> set[str]:
    if not SCHEMA_PATH.exists():
        return DEFAULT_ALLOWED_ACTIONS
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    enum_values = (
        schema.get("PlanOutlineSchema", {})
        .get("properties", {})
        .get("stepOutlines", {})
        .get("items", {})
        .get("properties", {})
        .get("action", {})
        .get("enum")
    )
    if not isinstance(enum_values, list) or not enum_values:
        return DEFAULT_ALLOWED_ACTIONS
    return set(str(item) for item in enum_values)


ALLOWED_ACTIONS = load_allowed_actions()

PHASES = [
    "阶段1-分析",
    "阶段2-创建",
    "阶段3-安装",
    "阶段4-验证",
    "阶段5-启动",
    "阶段6-浏览器验证",
    "阶段7-仓库管理",
]

PLACEHOLDER_RE = re.compile(r"\{[A-Za-z_][A-Za-z0-9_]*\}")

INSTRUCTION = (
    "你是一个资深前端工程师和项目规划专家。请根据以下任务描述和项目上下文，"
    "生成一个结构化的执行计划。计划应按阶段组织（阶段1-分析、阶段2-创建、"
    "阶段3-安装、阶段4-验证、阶段5-启动、阶段6-浏览器验证、阶段7-仓库管理），"
    "每个步骤包含 description（描述）、action（动作类型）、phase（所属阶段）。"
    "同时提供 risks（潜在风险）和 alternatives（备选方案）。\n\n"
    "可用的动作类型: read_file, list_directory, create_file, apply_patch, "
    "search_code, get_ast, run_command, browser_navigate, browser_screenshot, "
    "get_page_structure, browser_click, browser_type\n\n"
    "质量要求: action 必须只输出枚举值，不要把工具说明写进 action；"
    "新增或修改文件前必须先安排探索步骤；不要为查询任务生成写文件、git 或启动服务步骤。"
)

PLANNER_SYSTEM = (
    "你是一位经验丰富的高级软件工程师，擅长将前端工程任务拆解为可执行计划。\n"
    "只输出 JSON 对象，格式为 {summary, stepOutlines, risks, alternatives}。\n"
    "stepOutlines[].action 必须是以下枚举之一: "
    + ", ".join(sorted(ALLOWED_ACTIONS))
    + "。每个步骤必须包含 description、action、phase。"
)


FRAMEWORKS = [
    "React + TypeScript + Vite",
    "Vue 3 + TypeScript",
    "Next.js 14 App Router",
    "Nuxt 3 + TypeScript",
    "pnpm monorepo + React component library",
    "React Native Web + Expo",
]
CSS_OPTIONS = ["Tailwind CSS", "CSS Modules", "Styled Components", "Ant Design 5", "Material UI"]
COMPONENTS = [
    "导航栏",
    "侧边栏",
    "数据表格",
    "文件上传",
    "图片轮播",
    "下拉选择",
    "日期选择器",
    "模态对话框",
    "通知提示",
    "面包屑",
    "分页器",
    "搜索框",
    "标签页",
    "步骤条",
    "树形控件",
    "虚拟列表",
]
PAGES = ["用户登录", "用户注册", "个人设置", "商品详情", "购物车", "订单列表", "数据看板", "消息中心", "文件管理", "权限管理", "系统配置", "操作日志"]
FEATURES = ["排序筛选", "分页加载", "拖拽排序", "批量操作", "实时搜索", "数据导出", "主题切换", "国际化", "键盘快捷键", "无限滚动", "虚拟列表"]
FORMS = ["用户信息编辑", "商品发布", "订单创建", "审批流程", "问卷调查", "评论提交"]
FIELDS = ["用户名、邮箱、手机号", "标题、内容、分类、标签", "收货地址、支付方式", "开始日期、结束日期、优先级", "评分、文字评论、图片上传"]
VALIDATIONS = ["实时校验", "提交时校验", "自定义规则校验", "异步校验"]
BUGS = ["样式错位", "状态不同步", "内存泄漏", "渲染性能问题", "事件处理异常", "路由跳转错误"]
ASPECTS = ["代码结构", "性能瓶颈", "安全漏洞", "可访问性", "SEO 优化", "测试覆盖"]
TESTS = ["单元测试", "组件测试", "E2E 测试", "可访问性测试"]
LAYOUTS = ["卡片式", "列表式", "分栏式", "瀑布流", "时间线"]
ANIMATIONS = ["淡入淡出", "滑动", "缩放", "弹性", "骨架屏过渡"]
CHARTS = ["折线图", "柱状图", "饼图", "散点图", "热力图"]
LIBRARIES = ["ECharts", "Recharts", "Chart.js", "D3.js", "Ant Design Charts"]
AUTH_FLOWS = ["OAuth 第三方登录", "JWT Token", "短信验证码", "多因素认证"]
DASHBOARDS = ["运营数据", "用户分析", "销售统计", "系统监控"]
RESPONSIVE = ["断点适配", "流式布局", "弹性盒布局"]
DESIGNS = ["Material Design", "Apple HIG", "Ant Design 规范", "企业设计系统"]
ELEMENTS = ["基础信息、权限设置、通知偏好", "筛选区、数据表格、详情抽屉", "统计卡片、趋势图、操作日志", "导航菜单、内容面板、保存按钮"]
METRICS = ["首屏加载速度", "交互响应速度", "渲染帧率", "包体积", "可维护性"]
ISSUES = ["重复逻辑", "无效依赖", "类型不安全", "缺少错误处理", "路由结构混乱"]

CONTEXTS = [
    "React + TypeScript + Vite 项目，使用 Tailwind CSS。src/components 存放通用组件，src/pages 存放页面组件。",
    "Next.js 14 App Router 项目，使用 TypeScript 和 shadcn/ui，已有用户认证模块和基础布局。",
    "Vue 3 + TypeScript 项目，使用 Pinia 和 Vue Router，Element Plus 作为 UI 库。",
    "React Native Web 项目，使用 Expo 和 React Navigation，已有底部 Tab 导航结构。",
    "pnpm workspace monorepo，包含 apps/web、apps/admin 和 packages/ui 共享组件库。",
    "Nuxt 3 + TypeScript 项目，使用 Tailwind CSS，已有 SSR 配置和 API 路由层。",
    "企业后台项目，React + TypeScript + Ant Design 5，路由、权限和请求封装已经存在。",
    "组件库项目，React + TypeScript + Storybook，包管理使用 pnpm，组件位于 packages/ui/src。",
]

TASK_BLUEPRINTS = [
    ("create", "simple", "创建一个{component}组件，包含{feature1}和{feature2}功能"),
    ("create", "medium", "创建一个{page}页面，使用{layout}布局，包含{elements}"),
    ("create", "complex", "创建一个{dashboard}管理面板，包含{widgets}等模块，并支持{feature}"),
    ("modify", "simple", "为{component}添加{feature}功能，确保不影响现有功能"),
    ("modify", "medium", "为{page}页面添加{responsive}响应式支持"),
    ("modify", "complex", "更新{component}的{style}样式，使其符合{design}设计规范"),
    ("refactor", "medium", "重构{file}文件，将{old_pattern}改为{new_pattern}"),
    ("refactor", "complex", "将{component}拆分为{subcomponents}子组件，并保持外部 API 不变"),
    ("debug", "medium", "修复{component}中的{bug}问题"),
    ("debug", "complex", "排查{page}页面白屏问题，定位可能的路由、依赖或运行时异常"),
    ("query", "simple", "分析项目的{aspect}，找出{issue}问题"),
    ("query", "medium", "列出项目中所有{pattern}的使用情况，并总结风险"),
    ("test", "medium", "添加{test}到{component}组件，覆盖主要交互路径"),
    ("review", "medium", "审查{file}文件中的{concern}，输出主要风险和改进建议"),
    ("migration", "complex", "将{component}组件从{old}迁移到{new}，保持现有功能不变"),
]


def load_env(env_path: str = ".env") -> dict[str, str]:
    env: dict[str, str] = {}
    path = Path(env_path)
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def rng_choice(values: list[str], rng: random.Random) -> str:
    return values[rng.randrange(len(values))]


def random_fill(template: str, seed: int) -> str:
    rng = random.Random(seed)
    replacements = {
        "{framework}": rng_choice(FRAMEWORKS, rng),
        "{css}": rng_choice(CSS_OPTIONS, rng),
        "{component}": rng_choice(COMPONENTS, rng),
        "{page}": rng_choice(PAGES, rng),
        "{feature}": rng_choice(FEATURES, rng),
        "{feature1}": rng_choice(FEATURES, rng),
        "{feature2}": rng_choice(FEATURES, rng),
        "{form}": rng_choice(FORMS, rng),
        "{fields}": rng_choice(FIELDS, rng),
        "{validation}": rng_choice(VALIDATIONS, rng),
        "{bug}": rng_choice(BUGS, rng),
        "{aspect}": rng_choice(ASPECTS, rng),
        "{test}": rng_choice(TESTS, rng),
        "{layout}": rng_choice(LAYOUTS, rng),
        "{animation}": rng_choice(ANIMATIONS, rng),
        "{chart}": rng_choice(CHARTS, rng),
        "{library}": rng_choice(LIBRARIES, rng),
        "{data}": rng_choice(["销售", "用户活跃", "流量", "性能指标"], rng),
        "{auth}": rng_choice(AUTH_FLOWS, rng),
        "{dashboard}": rng_choice(DASHBOARDS, rng),
        "{widgets}": rng_choice(["图表、统计卡片、数据表格", "日历、待办事项、公告", "实时监控、告警列表"], rng),
        "{pages}": rng_choice(["登录、注册、忘记密码", "授权确认、绑定手机", "设置安全问题"], rng),
        "{props}": rng_choice(["size、variant、disabled", "theme、locale、direction", "mode、placement、closable"], rng),
        "{old}": rng_choice(["Class Component", "JavaScript", "Options API", "CSS 文件", "Redux Toolkit"], rng),
        "{new}": rng_choice(["Function Component", "TypeScript", "Composition API", "CSS-in-JS", "Zustand"], rng),
        "{old_pattern}": rng_choice(["useState", "any 类型", "内联样式", "hardcoded 字符串", "重复请求逻辑"], rng),
        "{new_pattern}": rng_choice(["useReducer", "泛型类型", "CSS 变量", "i18n 国际化", "统一 request hook"], rng),
        "{file}": rng_choice(["App.tsx", "utils.ts", "api.ts", "store.ts", "routes.tsx"], rng),
        "{responsive}": rng_choice(RESPONSIVE, rng),
        "{style}": rng_choice(["颜色方案", "间距系统", "字体排版", "阴影效果"], rng),
        "{design}": rng_choice(DESIGNS, rng),
        "{api}": rng_choice(["用户信息", "商品列表", "订单详情", "文件上传"], rng),
        "{handling}": rng_choice(["try-catch", "全局拦截器", "重试机制", "离线缓存"], rng),
        "{subcomponents}": rng_choice(["Header、Body、Footer", "Form、Field、Submit", "List、Item、Empty"], rng),
        "{quality}": rng_choice(["性能", "可维护性", "可测试性", "可复用性"], rng),
        "{concern}": rng_choice(["类型安全", "代码规范", "潜在 bug", "安全风险"], rng),
        "{pattern}": rng_choice(["console.log", "any 类型", "TODO 注释", "硬编码 URL"], rng),
        "{dependency}": rng_choice(["lodash", "moment", "axios", "react-router"], rng),
        "{mobile}": rng_choice(["卡片列表", "抽屉菜单", "底部弹窗", "全屏展示"], rng),
        "{desktop}": rng_choice(["表格展示", "侧边栏导航", "弹窗形式", "分栏布局"], rng),
        "{elements}": rng_choice(ELEMENTS, rng),
        "{metric}": rng_choice(METRICS, rng),
        "{issue}": rng_choice(ISSUES, rng),
    }
    result = template
    for key, value in replacements.items():
        result = result.replace(key, value)
    return result


def step(description: str, action: str, phase: str) -> dict[str, str]:
    return {"description": description, "action": action, "phase": phase}


def make_plan(task: str, context: str, category: str, difficulty: str) -> dict[str, Any]:
    subject = task.replace("。", "")
    steps: list[dict[str, str]] = []

    if category in {"create", "modify", "refactor", "debug", "test", "review", "migration"}:
        steps.append(step("观察项目目录结构，确认技术栈、入口和目标目录", "list_directory", "阶段1-分析"))
        steps.append(step("搜索相关组件、路由、状态和样式实现，避免凭空选择路径", "search_code", "阶段1-分析"))
    else:
        steps.append(step("观察项目目录结构，定位与问题相关的模块", "list_directory", "阶段1-分析"))
        steps.append(step("搜索相关代码和配置，收集回答所需证据", "search_code", "阶段1-分析"))

    if category in {"modify", "refactor", "debug", "test", "review", "migration"}:
        steps.append(step("读取候选文件内容，确认现有实现和约束", "read_file", "阶段1-分析"))

    if category == "create":
        steps.extend(
            [
                step("用 shell 精确确认目标目录存在且目标文件不会覆盖已有实现", "run_command", "阶段1-分析"),
                step(f"创建实现 {subject} 所需的组件或页面文件", "create_file", "阶段2-创建"),
                step("按需补充导出、路由或示例入口", "apply_patch", "阶段2-创建"),
                step("运行类型检查或构建命令验证新增代码", "run_command", "阶段4-验证"),
                step("启动开发服务器用于页面级验证", "run_command", "阶段5-启动"),
                step("打开本地页面检查关键交互和布局", "browser_navigate", "阶段6-浏览器验证"),
                step("截取页面截图作为验收证据", "browser_screenshot", "阶段6-浏览器验证"),
            ]
        )
    elif category in {"modify", "refactor", "migration"}:
        steps.extend(
            [
                step(f"按最小改动原则实现 {subject}", "apply_patch", "阶段2-创建"),
                step("运行类型检查、测试或构建验证兼容性", "run_command", "阶段4-验证"),
            ]
        )
        if difficulty == "complex":
            steps.append(step("对受影响页面做一次浏览器级回归验证", "browser_navigate", "阶段6-浏览器验证"))
    elif category == "debug":
        steps.extend(
            [
                step("运行现有复现或检查命令，确认错误信号", "run_command", "阶段1-分析"),
                step("修复定位到的根因，避免无关重构", "apply_patch", "阶段2-创建"),
                step("重新运行复现、测试或构建命令确认问题消失", "run_command", "阶段4-验证"),
            ]
        )
    elif category == "test":
        steps.extend(
            [
                step("创建或更新测试文件覆盖主路径和边界状态", "create_file", "阶段2-创建"),
                step("运行对应测试命令并记录结果", "run_command", "阶段4-验证"),
            ]
        )
    elif category == "review":
        steps.append(step("输出审查发现、风险等级和建议，不修改文件", "read_file", "阶段1-分析"))
    elif category == "query":
        steps.append(step("汇总结构化结论并引用关键文件证据", "read_file", "阶段1-分析"))

    risks = [
        "路径或入口判断错误会导致计划不可执行，需要先观察再写入",
        "依赖、路由或构建脚本可能与上下文描述不一致，需要以仓库实际文件为准",
    ]
    alternatives = [
        "若目标目录不明确，先扩大 search_code/list_directory 范围再生成写入步骤",
        "若验证命令不存在，改用 package.json 中已有的最接近脚本",
    ]

    if category in {"query", "review"}:
        risks[0] = "只读任务不应生成 create_file、apply_patch、git 或浏览器启动步骤"
        alternatives[0] = "若证据不足，继续读取相关文件而不是直接给结论"

    return {
        "summary": f"为任务“{task}”生成 FrontAgent Planner 执行计划。",
        "stepOutlines": steps,
        "risks": risks,
        "alternatives": alternatives,
    }


def extract_json(text: str) -> dict[str, Any] | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return None


def generate_plan_with_teacher(client: Any, task: str, context: str, model: str) -> dict[str, Any] | None:
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=PLANNER_SYSTEM,
        messages=[{"role": "user", "content": f"任务：{task}\n\n项目上下文：\n{context}"}],
        temperature=0.2,
    )
    return extract_json(response.content[0].text)


def validate_plan(plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(plan.get("summary"), str) or not plan["summary"].strip():
        errors.append("missing summary")
    steps = plan.get("stepOutlines")
    if not isinstance(steps, list) or not steps:
        errors.append("missing stepOutlines")
        steps = []
    for idx, item in enumerate(steps):
        if not isinstance(item, dict):
            errors.append(f"step {idx} is not object")
            continue
        if not isinstance(item.get("description"), str) or not item["description"].strip():
            errors.append(f"step {idx} missing description")
        action = item.get("action")
        if action not in ALLOWED_ACTIONS:
            errors.append(f"step {idx} invalid action: {action}")
        if not isinstance(item.get("phase"), str) or not item["phase"].strip():
            errors.append(f"step {idx} missing phase")
    if not isinstance(plan.get("risks"), list) or not plan["risks"]:
        errors.append("risks must be non-empty list")
    if not isinstance(plan.get("alternatives"), list) or not plan["alternatives"]:
        errors.append("alternatives must be non-empty list")
    if PLACEHOLDER_RE.search(json.dumps(plan, ensure_ascii=False)):
        errors.append("unresolved placeholder in plan")
    return errors


def plan_to_alpaca(task: str, context: str, plan: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "instruction": INSTRUCTION,
        "input": f"任务：{task}\n\n项目上下文：\n{context}",
        "output": json.dumps(plan, ensure_ascii=False, indent=2),
        "metadata": metadata,
    }


def load_external_samples(paths: list[str]) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            raise FileNotFoundError(path)
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"{path} must contain a JSON array")
        for item in data:
            if {"instruction", "input", "output"}.issubset(item):
                plan = json.loads(item["output"])
                errors = validate_plan(plan)
                if errors:
                    raise ValueError(f"{path} contains invalid alpaca sample: {errors}")
                samples.append(item)
            elif {"task", "context", "plan"}.issubset(item):
                errors = validate_plan(item["plan"])
                if errors:
                    raise ValueError(f"{path} contains invalid plan sample: {errors}")
                samples.append(
                    plan_to_alpaca(
                        item["task"],
                        item["context"],
                        item["plan"],
                        {**item.get("metadata", {}), "source": "external"},
                    )
                )
            else:
                raise ValueError(f"{path} has unsupported sample shape")
    return samples


def build_samples(
    count: int,
    *,
    offset: int,
    mode: str,
    client: Any | None,
    teacher_model: str,
    split: str,
) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    attempts = 0
    while len(samples) < count:
        idx = offset + attempts
        category, difficulty, template = TASK_BLUEPRINTS[idx % len(TASK_BLUEPRINTS)]
        task = random_fill(template, seed=idx * 7919 + 17)
        context = CONTEXTS[idx % len(CONTEXTS)]
        if PLACEHOLDER_RE.search(task):
            raise ValueError(f"unresolved placeholder in task: {task}")

        plan = (
            generate_plan_with_teacher(client, task, context, teacher_model)
            if mode == "teacher" and client is not None
            else make_plan(task, context, category, difficulty)
        )
        attempts += 1
        if plan is None:
            continue

        errors = validate_plan(plan)
        if errors:
            print(f"[skip] {task[:60]}... -> {errors}")
            continue

        samples.append(
            plan_to_alpaca(
                task,
                context,
                plan,
                {
                    "source": "teacher" if mode == "teacher" else "offline-template",
                    "category": category,
                    "difficulty": difficulty,
                    "split": split,
                    "seed": idx,
                },
            )
        )
        if mode == "teacher":
            time.sleep(0.3)
    return samples


def dedupe_samples(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for sample in samples:
        key = sample["input"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(sample)
    return deduped


def fill_to_count(
    samples: list[dict[str, Any]],
    target_count: int,
    *,
    offset: int,
    mode: str,
    client: Any | None,
    teacher_model: str,
    split: str,
) -> list[dict[str, Any]]:
    result = dedupe_samples(samples)
    cursor = offset
    while len(result) < target_count:
        needed = target_count - len(result)
        batch = build_samples(
            max(needed * 2, 16),
            offset=cursor,
            mode=mode,
            client=client,
            teacher_model=teacher_model,
            split=split,
        )
        cursor += max(needed * 2, 16)
        result = dedupe_samples(result + batch)
    return result[:target_count]


def validate_dataset(samples: list[dict[str, Any]]) -> dict[str, Any]:
    errors: list[str] = []
    seen_inputs: set[str] = set()
    categories: dict[str, int] = {}
    difficulties: dict[str, int] = {}
    actions: dict[str, int] = {}

    for idx, sample in enumerate(samples):
        for key in ("instruction", "input", "output"):
            if key not in sample or not isinstance(sample[key], str) or not sample[key].strip():
                errors.append(f"sample {idx} missing {key}")
        if sample.get("input") in seen_inputs:
            errors.append(f"sample {idx} duplicate input")
        seen_inputs.add(sample.get("input", ""))
        if PLACEHOLDER_RE.search(sample.get("input", "")):
            errors.append(f"sample {idx} unresolved placeholder in input")
        try:
            plan = json.loads(sample["output"])
        except Exception as exc:
            errors.append(f"sample {idx} invalid output JSON: {exc}")
            continue
        for error in validate_plan(plan):
            errors.append(f"sample {idx}: {error}")
        metadata = sample.get("metadata", {})
        categories[metadata.get("category", "unknown")] = categories.get(metadata.get("category", "unknown"), 0) + 1
        difficulties[metadata.get("difficulty", "unknown")] = difficulties.get(metadata.get("difficulty", "unknown"), 0) + 1
        for item in plan.get("stepOutlines", []):
            action = item.get("action")
            actions[action] = actions.get(action, 0) + 1

    return {
        "total": len(samples),
        "valid": not errors,
        "errors": errors[:50],
        "error_count": len(errors),
        "categories": categories,
        "difficulties": difficulties,
        "actions": actions,
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_teacher_client(args: argparse.Namespace) -> Any:
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError("teacher mode requires the anthropic package") from exc

    env = load_env(args.env)
    api_key = (
        args.api_key
        or os.environ.get("ANTHROPIC_AUTH_TOKEN")
        or os.environ.get("ANTHROPIC_API_KEY")
        or env.get("auth_token")
        or env.get("api_key")
    )
    base_url = args.base_url or os.environ.get("ANTHROPIC_BASE_URL") or env.get("base_url")
    if not api_key:
        raise RuntimeError("teacher mode requires ANTHROPIC_API_KEY, --api-key, or .env api_key")
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return anthropic.Anthropic(**kwargs)


def main() -> None:
    parser = argparse.ArgumentParser(description="FrontAgent Planner v2 data generator")
    parser.add_argument("--mode", choices=["offline", "teacher"], default="offline")
    parser.add_argument("--train-count", type=int, default=500)
    parser.add_argument("--eval-count", type=int, default=100)
    parser.add_argument("--output-dir", default=str(SCRIPT_DIR))
    parser.add_argument("--train-output", default="train_v2.json")
    parser.add_argument("--eval-output", default="eval_v2.json")
    parser.add_argument("--external-samples", nargs="*", default=[], help="Optional curated or real-run samples")
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--env", default=str(SCRIPT_DIR.parent / ".env"))
    parser.add_argument("--validate-only", nargs="*", default=None, help="Validate existing dataset files")
    args = parser.parse_args()

    if args.validate_only is not None:
        failed = False
        for raw_path in args.validate_only:
            path = Path(raw_path)
            data = json.loads(path.read_text(encoding="utf-8"))
            summary = validate_dataset(data)
            print(json.dumps({"path": str(path), **summary}, ensure_ascii=False, indent=2))
            failed = failed or not summary["valid"]
        if failed:
            raise SystemExit(1)
        return

    output_dir = Path(args.output_dir)
    teacher_model = args.model or os.environ.get("ANTHROPIC_MODEL") or "claude-sonnet-4-20250514"
    client = create_teacher_client(args) if args.mode == "teacher" else None

    external = load_external_samples(args.external_samples)
    external = dedupe_samples(external)

    train_external = [s for s in external if s.get("metadata", {}).get("split") != "eval"]
    eval_external = [s for s in external if s.get("metadata", {}).get("split") == "eval"]

    train_needed = max(0, args.train_count - len(train_external))
    eval_needed = max(0, args.eval_count - len(eval_external))

    train_samples = fill_to_count(
        train_external
        + build_samples(
            train_needed,
            offset=0,
            mode=args.mode,
            client=client,
            teacher_model=teacher_model,
            split="train",
        ),
        args.train_count,
        offset=10_000,
        mode=args.mode,
        client=client,
        teacher_model=teacher_model,
        split="train",
    )
    eval_samples = fill_to_count(
        eval_external
        + build_samples(
            eval_needed,
            offset=100_000,
            mode=args.mode,
            client=client,
            teacher_model=teacher_model,
            split="eval",
        ),
        args.eval_count,
        offset=200_000,
        mode=args.mode,
        client=client,
        teacher_model=teacher_model,
        split="eval",
    )

    train_summary = validate_dataset(train_samples)
    eval_summary = validate_dataset(eval_samples)
    if not train_summary["valid"] or not eval_summary["valid"]:
        print(json.dumps({"train": train_summary, "eval": eval_summary}, ensure_ascii=False, indent=2))
        raise SystemExit(1)

    train_path = output_dir / args.train_output
    eval_path = output_dir / args.eval_output
    write_json(train_path, train_samples)
    write_json(eval_path, eval_samples)
    print(json.dumps({"train": {"path": str(train_path), **train_summary}, "eval": {"path": str(eval_path), **eval_summary}}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
