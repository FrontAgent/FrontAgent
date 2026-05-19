"""
FrontAgent Planner evaluator.

Supports two modes:
- score-only: evaluate JSON plans already stored in an Alpaca-format dataset
- inference: load a base model plus optional LoRA adapter and score generated plans

The v2 score goes beyond JSON validity and checks schema, action enums, phase
ordering, executability hints, overplanning, and task fit.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA_PATH = Path(__file__).resolve().parent / "prompts" / "schema.json"

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

PHASE_ORDER = {
    "阶段1-分析": 1,
    "阶段2-创建": 2,
    "阶段3-安装": 3,
    "阶段4-验证": 4,
    "阶段5-启动": 5,
    "阶段6-浏览器验证": 6,
    "阶段7-仓库管理": 7,
}

SYSTEM_PROMPT = (
    "你是一个资深前端工程师和项目规划专家。请根据以下任务描述和项目上下文，"
    "生成一个结构化的执行计划。计划应按阶段组织（阶段1-分析、阶段2-创建、"
    "阶段3-安装、阶段4-验证、阶段5-启动、阶段6-浏览器验证、阶段7-仓库管理），"
    "每个步骤包含 description（描述）、action（动作类型）、phase（所属阶段）。"
    "同时提供 risks（潜在风险）和 alternatives（备选方案）。\n\n"
    "可用的动作类型: read_file, list_directory, create_file, apply_patch, "
    "search_code, get_ast, run_command, browser_navigate, browser_screenshot, "
    "get_page_structure, browser_click, browser_type\n\n"
    "只输出 JSON，不要输出 markdown。"
)

DEFAULT_EVAL_TASKS = [
    {
        "id": "builtin-1",
        "task": "创建一个深色主题的 Dashboard 布局，左侧固定导航栏，右侧内容区支持面包屑导航",
        "context": "React 18 + TypeScript + Ant Design 5 项目，已有基础路由配置",
    },
    {
        "id": "builtin-2",
        "task": "实现一个拖拽排序的看板组件，支持三列，卡片可在列间移动",
        "context": "Next.js 14 + Tailwind CSS + @dnd-kit/core",
    },
    {
        "id": "builtin-3",
        "task": "给现有表单添加实时校验功能，支持异步检查用户名是否已存在",
        "context": "Vue 3 + TypeScript + Element Plus 表单组件",
    },
    {
        "id": "builtin-4",
        "task": "重构全局状态管理，从 Redux Toolkit 迁移到 Zustand，保持现有功能不变",
        "context": "React 18 + TypeScript + Redux Toolkit + Zustand",
    },
    {
        "id": "builtin-5",
        "task": "构建一个 CLI 脚手架工具，支持交互式选择模板、安装依赖、初始化 Git 仓库",
        "context": "Node.js + TypeScript + Commander.js + Inquirer.js + degit",
    },
]


@dataclass
class EvalResult:
    task_id: str
    task: str
    success: bool
    json_valid: bool
    schema_valid: bool
    action_valid: bool
    phase_valid: bool
    has_risks: bool
    has_alternatives: bool
    phases_count: int
    steps_count: int
    executable_score: float
    overplanning_penalty: float
    task_fit_score: float
    quality_score: float
    latency_ms: float = 0
    output_raw: str = ""
    errors: list[str] | None = None


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


def infer_task_type(task: str) -> str:
    lowered = task.lower()
    if any(word in task for word in ["创建", "新增", "实现", "构建"]) or "add " in lowered:
        return "create"
    if any(word in task for word in ["重构", "迁移", "拆分"]):
        return "refactor"
    if any(word in task for word in ["修复", "排查", "debug", "白屏", "错误"]):
        return "debug"
    if any(word in task for word in ["测试", "test", "覆盖"]):
        return "test"
    if any(word in task for word in ["审查", "review", "检查"]):
        return "review"
    if any(word in task for word in ["分析", "列出", "梳理", "总结"]):
        return "query"
    return "modify"


def normalize_steps(plan: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(plan.get("stepOutlines"), list):
        return [s for s in plan["stepOutlines"] if isinstance(s, dict)]
    if isinstance(plan.get("steps"), list):
        return [s for s in plan["steps"] if isinstance(s, dict)]
    steps: list[dict[str, Any]] = []
    phases = plan.get("phases")
    if isinstance(phases, list):
        for phase in phases:
            if not isinstance(phase, dict):
                continue
            phase_name = phase.get("name") or phase.get("phase")
            for item in phase.get("steps", []):
                if isinstance(item, dict):
                    copy = dict(item)
                    copy.setdefault("phase", phase_name)
                    steps.append(copy)
    return steps


def phase_rank(phase: Any) -> int:
    if not isinstance(phase, str):
        return 999
    for name, rank in PHASE_ORDER.items():
        if name in phase:
            return rank
    match = re.search(r"阶段\s*(\d+)", phase)
    return int(match.group(1)) if match else 999


def required_params_ok(step: dict[str, Any]) -> bool:
    action = step.get("action")
    params = step.get("params")
    if params is None:
        return True
    if not isinstance(params, dict):
        return False
    if action in {"read_file", "create_file", "apply_patch", "get_ast"}:
        return isinstance(params.get("path"), str) and bool(params["path"].strip())
    if action == "run_command":
        return isinstance(params.get("command"), str) and bool(params["command"].strip())
    if action == "browser_navigate":
        return isinstance(params.get("url"), str) and bool(params["url"].strip())
    if action == "search_code":
        return any(isinstance(params.get(key), str) and params[key].strip() for key in ("query", "pattern", "filePattern"))
    return True


def score_executable(steps: list[dict[str, Any]]) -> tuple[float, list[str]]:
    if not steps:
        return 0, ["no steps"]

    errors: list[str] = []
    score = 1.0
    actions = [step.get("action") for step in steps]
    first_write = next((i for i, action in enumerate(actions) if action in {"create_file", "apply_patch"}), None)
    if first_write is not None:
        previous = set(actions[:first_write])
        if not previous.intersection({"list_directory", "search_code", "read_file", "get_ast"}):
            score -= 0.35
            errors.append("write step appears before exploration")

    bad_params = [idx for idx, item in enumerate(steps) if not required_params_ok(item)]
    if bad_params:
        score -= min(0.35, 0.08 * len(bad_params))
        errors.append(f"steps with invalid params: {bad_params[:5]}")

    ranks = [phase_rank(item.get("phase")) for item in steps]
    out_of_order = sum(1 for left, right in zip(ranks, ranks[1:]) if right < left and right != 1)
    if out_of_order:
        score -= min(0.2, 0.05 * out_of_order)
        errors.append("phase order is inconsistent")

    return max(0.0, score), errors


def overplanning_penalty(task_type: str, steps: list[dict[str, Any]]) -> tuple[float, list[str]]:
    errors: list[str] = []
    penalty = 0.0
    actions = [step.get("action") for step in steps]
    descriptions = " ".join(str(step.get("description", "")) for step in steps).lower()

    if task_type in {"query", "review"} and any(action in {"create_file", "apply_patch"} for action in actions):
        penalty += 0.35
        errors.append("read-only task contains write steps")
    if task_type in {"query", "review"} and ("git " in descriptions or "gh " in descriptions or "pull request" in descriptions):
        penalty += 0.25
        errors.append("read-only task contains repository automation")
    if task_type in {"modify", "refactor", "debug"} and actions.count("run_command") > 3:
        penalty += 0.15
        errors.append("too many command steps")
    if len(steps) > 18:
        penalty += min(0.2, (len(steps) - 18) * 0.02)
        errors.append("too many steps")
    return min(1.0, penalty), errors


def task_fit_score(task_type: str, steps: list[dict[str, Any]]) -> tuple[float, list[str]]:
    actions = {step.get("action") for step in steps}
    errors: list[str] = []
    score = 1.0

    if task_type == "create" and not actions.intersection({"create_file", "apply_patch"}):
        score -= 0.45
        errors.append("create task lacks write action")
    if task_type in {"modify", "refactor"} and "apply_patch" not in actions:
        score -= 0.4
        errors.append("modify/refactor task lacks apply_patch")
    if task_type == "debug" and not actions.intersection({"search_code", "read_file", "run_command"}):
        score -= 0.4
        errors.append("debug task lacks investigation actions")
    if task_type == "test" and "run_command" not in actions:
        score -= 0.25
        errors.append("test task lacks test command")
    if task_type in {"query", "review"} and not actions.intersection({"read_file", "search_code", "list_directory"}):
        score -= 0.4
        errors.append("query/review task lacks evidence-gathering actions")
    return max(0.0, score), errors


def evaluate_plan(plan: dict[str, Any] | None, task: str = "") -> dict[str, Any]:
    if plan is None:
        return {
            "json_valid": False,
            "schema_valid": False,
            "action_valid": False,
            "phase_valid": False,
            "has_risks": False,
            "has_alternatives": False,
            "phases_count": 0,
            "steps_count": 0,
            "executable_score": 0,
            "overplanning_penalty": 1,
            "task_fit_score": 0,
            "quality_score": 0,
            "errors": ["invalid json"],
        }

    errors: list[str] = []
    steps = normalize_steps(plan)
    actions = [step.get("action") for step in steps]
    phases = [step.get("phase") for step in steps]
    has_risks = isinstance(plan.get("risks"), list) and bool(plan.get("risks"))
    has_alternatives = isinstance(plan.get("alternatives"), list) and bool(plan.get("alternatives"))
    action_valid = bool(steps) and all(action in ALLOWED_ACTIONS for action in actions)
    phase_valid = bool(steps) and all(isinstance(phase, str) and phase.strip() for phase in phases)
    schema_valid = (
        isinstance(plan.get("summary"), str)
        and bool(plan.get("summary", "").strip())
        and bool(steps)
        and all(isinstance(step.get("description"), str) and step["description"].strip() for step in steps)
        and action_valid
        and phase_valid
        and has_risks
        and has_alternatives
    )
    if not schema_valid:
        errors.append("schema validation failed")
    if not action_valid:
        errors.append("invalid action enum")
    if not phase_valid:
        errors.append("missing phase")

    executable_score, executable_errors = score_executable(steps)
    task_type = infer_task_type(task)
    penalty, penalty_errors = overplanning_penalty(task_type, steps)
    fit_score, fit_errors = task_fit_score(task_type, steps)
    errors.extend(executable_errors)
    errors.extend(penalty_errors)
    errors.extend(fit_errors)

    structure_score = (
        (1.0 if schema_valid else 0.0)
        + (1.0 if action_valid else 0.0)
        + (1.0 if phase_valid else 0.0)
    ) / 3
    quality_score = max(
        0.0,
        min(1.0, 0.35 * structure_score + 0.25 * executable_score + 0.25 * fit_score + 0.15 * (1 - penalty)),
    )

    phase_names = {phase for phase in phases if isinstance(phase, str) and phase.strip()}
    return {
        "json_valid": True,
        "schema_valid": schema_valid,
        "action_valid": action_valid,
        "phase_valid": phase_valid,
        "has_risks": has_risks,
        "has_alternatives": has_alternatives,
        "phases_count": len(phase_names),
        "steps_count": len(steps),
        "executable_score": round(executable_score, 4),
        "overplanning_penalty": round(penalty, 4),
        "task_fit_score": round(fit_score, 4),
        "quality_score": round(quality_score, 4),
        "errors": errors,
    }


def load_eval_records(path: str | None) -> list[dict[str, Any]]:
    if not path:
        return DEFAULT_EVAL_TASKS
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    records = []
    for idx, item in enumerate(raw):
        if {"input", "output"}.issubset(item):
            task, context = parse_input(item["input"])
            records.append(
                {
                    "id": item.get("metadata", {}).get("id", f"sample-{idx}"),
                    "task": task,
                    "context": context,
                    "expected_output": item["output"],
                }
            )
        else:
            records.append(item)
    return records


def parse_input(input_text: str) -> tuple[str, str]:
    task = input_text
    context = ""
    if "项目上下文：" in input_text:
        left, _, right = input_text.partition("项目上下文：")
        task = left.replace("任务：", "").strip()
        context = right.strip()
    return task, context


def generate(model: Any, tokenizer: Any, task: str, context: str, max_new_tokens: int) -> str:
    user_msg = f"任务：{task}\n\n项目上下文：\n{context}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    import torch

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.2,
            top_p=0.9,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = outputs[0][inputs["input_ids"].shape[1] :]
    return tokenizer.decode(generated, skip_special_tokens=True)


def load_model(args: argparse.Namespace) -> tuple[Any, Any]:
    from peft import PeftModel
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_len,
        dtype=None,
        load_in_4bit=True,
    )
    if args.adapter and not args.base_only:
        model = PeftModel.from_pretrained(model, args.adapter)
    tokenizer = get_chat_template(tokenizer, chat_template="chatml")
    return model, tokenizer


def result_from_metrics(task_id: str, task: str, metrics: dict[str, Any], latency_ms: float, raw: str) -> EvalResult:
    return EvalResult(
        task_id=str(task_id),
        task=task,
        success=bool(metrics["schema_valid"] and metrics["action_valid"] and metrics["quality_score"] >= 0.75),
        latency_ms=latency_ms,
        output_raw=raw,
        **metrics,
    )


def summarize(results: list[EvalResult]) -> dict[str, Any]:
    total = len(results)
    if total == 0:
        return {}

    def rate(attr: str) -> float:
        return sum(1 for item in results if getattr(item, attr)) / total

    def avg(attr: str) -> float:
        return sum(float(getattr(item, attr)) for item in results) / total

    return {
        "total": total,
        "success_rate": rate("success"),
        "json_valid_rate": rate("json_valid"),
        "schema_valid_rate": rate("schema_valid"),
        "action_valid_rate": rate("action_valid"),
        "phase_valid_rate": rate("phase_valid"),
        "avg_quality_score": avg("quality_score"),
        "avg_executable_score": avg("executable_score"),
        "avg_task_fit_score": avg("task_fit_score"),
        "avg_overplanning_penalty": avg("overplanning_penalty"),
        "avg_steps": avg("steps_count"),
        "avg_latency_ms": avg("latency_ms"),
        "quality_gate": {
            "schema_valid_100": rate("schema_valid") == 1.0,
            "action_valid_100": rate("action_valid") == 1.0,
            "avg_quality_at_least_0_85": avg("quality_score") >= 0.85,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="FrontAgent Planner evaluator")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-Coder-14B-Instruct")
    parser.add_argument("--adapter", default="output-14b/lora_adapter")
    parser.add_argument("--base-only", action="store_true", help="Evaluate base model without adapter")
    parser.add_argument("--eval-data", default="data/eval_v2.json")
    parser.add_argument("--score-only", action="store_true", help="Score outputs already stored in eval-data")
    parser.add_argument("--max-seq-len", type=int, default=2048)
    parser.add_argument("--max-new-tokens", type=int, default=1536)
    parser.add_argument("--output", default="eval_results_v2.json")
    args = parser.parse_args()

    records = load_eval_records(args.eval_data)
    model = tokenizer = None
    if not args.score_only:
        model, tokenizer = load_model(args)

    results: list[EvalResult] = []
    for record in records:
        task = record["task"]
        context = record.get("context", "")
        task_id = str(record.get("id", len(results) + 1))

        if args.score_only:
            raw = record.get("expected_output") or record.get("output") or "{}"
            latency = 0.0
        else:
            started = time.time()
            raw = generate(model, tokenizer, task, context, args.max_new_tokens)
            latency = (time.time() - started) * 1000

        plan = extract_json(raw)
        metrics = evaluate_plan(plan, task)
        result = result_from_metrics(task_id, task, metrics, latency, raw)
        results.append(result)
        print(
            f"[{task_id}] quality={result.quality_score:.3f} "
            f"schema={result.schema_valid} action={result.action_valid} "
            f"steps={result.steps_count} success={result.success}"
        )

    output_data = {
        "summary": summarize(results),
        "results": [
            {
                "task_id": item.task_id,
                "task": item.task,
                "success": item.success,
                "json_valid": item.json_valid,
                "schema_valid": item.schema_valid,
                "action_valid": item.action_valid,
                "phase_valid": item.phase_valid,
                "phases_count": item.phases_count,
                "steps_count": item.steps_count,
                "executable_score": item.executable_score,
                "overplanning_penalty": item.overplanning_penalty,
                "task_fit_score": item.task_fit_score,
                "quality_score": item.quality_score,
                "latency_ms": item.latency_ms,
                "errors": item.errors or [],
                "output": item.output_raw[:2000],
            }
            for item in results
        ],
    }
    Path(args.output).write_text(json.dumps(output_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output_data["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
