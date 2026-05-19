"""
FrontAgent Planner — 推理评估脚本

加载微调后的 LoRA adapter，在未见过的任务上测试:
1. JSON 结构合法率
2. 计划完整性 (是否包含 phases, steps, risks, alternatives)
3. 输出质量评估
"""

import json
import re
import argparse
import time
from pathlib import Path
from dataclasses import dataclass, field

import torch
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template


# ─── 测试用例 (未出现在训练集中的任务) ─────────────────────
EVAL_TASKS = [
    {
        "id": 1,
        "task": "创建一个深色主题的 Dashboard 布局，左侧固定导航栏，右侧内容区支持面包屑导航",
        "context": "React 18 + TypeScript + Ant Design 5 项目，已有基础路由配置",
    },
    {
        "id": 2,
        "task": "实现一个拖拽排序的看板组件，支持三列（待办、进行中、已完成），卡片可在列间移动",
        "context": "Next.js 14 + Tailwind CSS + @dnd-kit/core",
    },
    {
        "id": 3,
        "task": "给现有表单添加实时校验功能，支持自定义校验规则、异步校验（如检查用户名是否已存在）",
        "context": "Vue 3 + TypeScript + Element Plus 表单组件",
    },
    {
        "id": 4,
        "task": "实现图片上传组件，支持拖拽上传、多图预览、裁剪、压缩后上传到 OSS",
        "context": "React 18 + TypeScript + cropperjs + axios",
    },
    {
        "id": 5,
        "task": "重构全局状态管理，从 Redux Toolkit 迁移到 Zustand，保持现有功能不变",
        "context": "React 18 + TypeScript + Redux Toolkit (现有) + Zustand (目标)",
    },
    {
        "id": 6,
        "task": "添加国际化支持，中英文切换，路由级翻译文件按需加载",
        "context": "Next.js 14 App Router + next-intl",
    },
    {
        "id": 7,
        "task": "实现一个数据可视化页面，包含折线图、柱状图、饼图，支持时间范围筛选和数据导出",
        "context": "React 18 + TypeScript + ECharts 5",
    },
    {
        "id": 8,
        "task": "给组件库添加 Storybook 文档，包含 props 交互式编辑和代码示例展示",
        "context": "React 18 + TypeScript + Storybook 7 + pnpm monorepo",
    },
    {
        "id": 9,
        "task": "实现 WebSocket 实时消息通知系统，包含未读角标、消息列表、点击跳转",
        "context": "Vue 3 + TypeScript + Pinia + WebSocket API",
    },
    {
        "id": 10,
        "task": "构建一个 CLI 脚手架工具，支持交互式选择模板、自动安装依赖、初始化 Git 仓库",
        "context": "Node.js + TypeScript + Commander.js + Inquirer.js + degit",
    },
]

SYSTEM_PROMPT = (
    "你是一个资深前端工程师和项目规划专家。请根据以下任务描述和项目上下文，"
    "生成一个结构化的执行计划。计划应按阶段组织（阶段1-分析、阶段2-创建、"
    "阶段3-安装、阶段4-验证、阶段5-启动、阶段6-浏览器验证、阶段7-仓库管理），"
    "每个步骤包含 description（描述）、action（动作类型）、phase（所属阶段）。"
    "同时提供 risks（潜在风险）和 alternatives（备选方案）。\n\n"
    "可用的动作类型: read_file, list_directory, create_file, apply_patch, "
    "search_code, get_ast, run_command, browser_navigate, browser_screenshot, "
    "get_page_structure, browser_click, browser_type"
)


@dataclass
class EvalResult:
    task_id: int
    task: str
    success: bool
    json_valid: bool
    has_phases: bool
    has_steps: bool
    has_risks: bool
    has_alternatives: bool
    phases_count: int = 0
    steps_count: int = 0
    latency_ms: float = 0
    output_raw: str = ""
    error: str = ""


def generate(model, tokenizer, task: str, context: str, max_new_tokens: int = 1536) -> str:
    """推理生成"""
    user_msg = f"任务：{task}\n\n项目上下文：\n{context}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    # 只取生成部分
    generated = outputs[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(generated, skip_special_tokens=True)


def extract_json(text: str) -> dict | None:
    """从模型输出中提取 JSON (容忍 markdown code block)"""
    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试提取 ```json ... ``` 块
    pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试找第一个 { ... } 块
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    return None


def evaluate_plan(plan: dict | None) -> dict:
    """评估计划的完整性，兼容两种格式:
    - 嵌套格式: { phases: [{ name, steps: [...] }] }
    - 扁平格式: { stepOutlines: [{ description, action, phase }] }
    """
    if plan is None:
        return {
            "json_valid": False,
            "has_phases": False,
            "has_steps": False,
            "has_risks": False,
            "has_alternatives": False,
            "phases_count": 0,
            "steps_count": 0,
        }

    # 嵌套格式: phases[].steps[]
    phases = plan.get("phases", [])
    # 扁平格式: stepOutlines[]
    step_outlines = plan.get("stepOutlines", [])

    if isinstance(phases, list) and len(phases) > 0:
        # 嵌套格式
        steps_count = 0
        for phase in phases:
            if isinstance(phase, dict):
                steps = phase.get("steps", [])
                if isinstance(steps, list):
                    steps_count += len(steps)
        return {
            "json_valid": True,
            "has_phases": True,
            "has_steps": steps_count > 0,
            "has_risks": isinstance(plan.get("risks"), list) and len(plan.get("risks", [])) > 0,
            "has_alternatives": isinstance(plan.get("alternatives"), list) and len(plan.get("alternatives", [])) > 0,
            "phases_count": len(phases),
            "steps_count": steps_count,
        }
    elif isinstance(step_outlines, list) and len(step_outlines) > 0:
        # 扁平格式: 从 steps 的 phase 字段统计阶段数
        phase_names = set()
        for step in step_outlines:
            if isinstance(step, dict) and "phase" in step:
                phase_names.add(step["phase"])
        return {
            "json_valid": True,
            "has_phases": len(phase_names) > 0,
            "has_steps": True,
            "has_risks": isinstance(plan.get("risks"), list) and len(plan.get("risks", [])) > 0,
            "has_alternatives": isinstance(plan.get("alternatives"), list) and len(plan.get("alternatives", [])) > 0,
            "phases_count": len(phase_names),
            "steps_count": len(step_outlines),
        }
    else:
        return {
            "json_valid": True,
            "has_phases": False,
            "has_steps": False,
            "has_risks": isinstance(plan.get("risks"), list) and len(plan.get("risks", [])) > 0,
            "has_alternatives": isinstance(plan.get("alternatives"), list) and len(plan.get("alternatives", [])) > 0,
            "phases_count": 0,
            "steps_count": 0,
        }


def main():
    parser = argparse.ArgumentParser(description="FrontAgent Planner 推理评估")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-Coder-7B")
    parser.add_argument("--adapter", default="output/lora_adapter", help="LoRA adapter 路径")
    parser.add_argument("--max-seq-len", type=int, default=2048)
    parser.add_argument("--max-new-tokens", type=int, default=1536)
    parser.add_argument("--output", default="eval_results.json", help="结果输出路径")
    parser.add_argument("--compare-base", action="store_true", help="同时测试基座模型作对比")
    args = parser.parse_args()

    # ── 1. 加载微调模型 ─────────────────────────────────
    print(f"加载微调模型: {args.base_model} + {args.adapter}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_len,
        dtype=None,
        load_in_4bit=True,
    )
    from peft import PeftModel
    model = PeftModel.from_pretrained(model, args.adapter)
    tokenizer = get_chat_template(tokenizer, chat_template="chatml")

    # ── 可选: 加载基座模型做对比 ────────────────────────
    base_model = None
    if args.compare_base:
        print(f"加载基座模型 (无微调) 用于对比...")
        base_model, base_tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.base_model,
            max_seq_length=args.max_seq_len,
            dtype=None,
            load_in_4bit=True,
        )
        base_tokenizer = get_chat_template(base_tokenizer, chat_template="chatml")

    # ── 2. 逐任务评估 ──────────────────────────────────
    results = []
    for task_info in EVAL_TASKS:
        task_id = task_info["id"]
        task = task_info["task"]
        context = task_info["context"]
        print(f"\n{'='*60}")
        print(f"[{task_id}/10] {task}")

        # 微调模型推理
        t0 = time.time()
        raw_output = generate(model, tokenizer, task, context, args.max_new_tokens)
        latency = (time.time() - t0) * 1000

        plan = extract_json(raw_output)
        metrics = evaluate_plan(plan)

        result = EvalResult(
            task_id=task_id,
            task=task,
            success=metrics["json_valid"] and metrics["has_phases"] and metrics["has_steps"],
            latency_ms=latency,
            output_raw=raw_output,
            **metrics,
        )
        results.append(result)

        status = "PASS" if result.success else "FAIL"
        print(f"  JSON: {'valid' if metrics['json_valid'] else 'INVALID'} | "
              f"Phases: {metrics['phases_count']} | Steps: {metrics['steps_count']} | "
              f"Risks: {'Y' if metrics['has_risks'] else 'N'} | "
              f"Alts: {'Y' if metrics['has_alternatives'] else 'N'} | "
              f"{latency:.0f}ms | {status}")

    # ── 3. 汇总统计 ────────────────────────────────────
    total = len(results)
    json_valid_count = sum(1 for r in results if r.json_valid)
    success_count = sum(1 for r in results if r.success)
    avg_steps = sum(r.steps_count for r in results) / total if total else 0
    avg_latency = sum(r.latency_ms for r in results) / total if total else 0

    print(f"\n{'='*60}")
    print(f"评估汇总")
    print(f"{'='*60}")
    print(f"总任务数:    {total}")
    print(f"JSON 合法率: {json_valid_count}/{total} ({100*json_valid_count/total:.1f}%)")
    print(f"完整计划率:  {success_count}/{total} ({100*success_count/total:.1f}%)")
    print(f"平均步骤数:  {avg_steps:.1f}")
    print(f"平均延迟:    {avg_latency:.0f}ms")

    # ── 4. 保存详细结果 ────────────────────────────────
    output_data = {
        "summary": {
            "total": total,
            "json_valid_rate": json_valid_count / total,
            "success_rate": success_count / total,
            "avg_steps": avg_steps,
            "avg_latency_ms": avg_latency,
        },
        "results": [
            {
                "task_id": r.task_id,
                "task": r.task,
                "success": r.success,
                "json_valid": r.json_valid,
                "phases_count": r.phases_count,
                "steps_count": r.steps_count,
                "has_risks": r.has_risks,
                "has_alternatives": r.has_alternatives,
                "latency_ms": r.latency_ms,
                "output": r.output_raw[:2000],  # 截断保存
            }
            for r in results
        ],
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"\n详细结果已保存到: {args.output}")


if __name__ == "__main__":
    main()
