"""
FrontAgent Planner Apple Silicon MLX LoRA training launcher.

This script is the local-Mac counterpart of train.py. It converts the v2
Alpaca-style data into MLX-LM chat JSONL files, writes an MLX LoRA config, and
optionally launches `mlx_lm lora`.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_BASE_MODEL = "mlx-community/Qwen2.5-Coder-14B-Instruct-4bit"
DEFAULT_SYSTEM_PROMPT = "你是一个资深前端工程师和项目规划专家。只输出 JSON，不要输出 markdown。"
DEFAULT_LORA_KEYS = [
    "self_attn.q_proj",
    "self_attn.k_proj",
    "self_attn.v_proj",
    "self_attn.o_proj",
    "mlp.gate_proj",
    "mlp.up_proj",
    "mlp.down_proj",
]


def load_rows(path: Path, max_samples: int | None = None) -> list[dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError(f"{path} must contain a JSON array")
    if max_samples is not None:
        rows = rows[:max_samples]
    return rows


def to_chat_row(row: dict[str, Any], system_prompt: str) -> dict[str, Any]:
    instruction = str(row.get("instruction", "")).strip()
    input_text = str(row.get("input", "")).strip()
    output_text = str(row.get("output", "")).strip()
    if not instruction or not output_text:
        raise ValueError("each row must contain non-empty instruction and output")

    user_content = instruction
    if input_text:
        user_content = f"{instruction}\n\n{input_text}"

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": output_text},
        ]
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]], system_prompt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(to_chat_row(row, system_prompt), ensure_ascii=False))
            handle.write("\n")


def split_eval_rows(rows: list[dict[str, Any]], test_ratio: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not rows:
        raise ValueError("eval rows must not be empty")
    if len(rows) == 1:
        return rows, rows

    test_count = max(1, round(len(rows) * test_ratio))
    test_count = min(test_count, len(rows) - 1)
    return rows[:-test_count], rows[-test_count:]


def prepare_mlx_data(args: argparse.Namespace) -> Path:
    data_dir = args.output / "mlx-data"
    train_rows = load_rows(args.train_data, args.max_train_samples)
    eval_rows = load_rows(args.eval_data, args.max_eval_samples)
    valid_rows, test_rows = split_eval_rows(eval_rows, args.test_ratio)

    write_jsonl(data_dir / "train.jsonl", train_rows, args.system_prompt)
    write_jsonl(data_dir / "valid.jsonl", valid_rows, args.system_prompt)
    write_jsonl(data_dir / "test.jsonl", test_rows, args.system_prompt)

    print(f"Wrote MLX data: {data_dir}", flush=True)
    print(f"  train={len(train_rows)} valid={len(valid_rows)} test={len(test_rows)}", flush=True)
    return data_dir


def write_mlx_config(args: argparse.Namespace, data_dir: Path, adapter_path: Path) -> Path:
    config = {
        "model": args.base_model,
        "train": True,
        "test": args.test,
        "data": str(data_dir),
        "fine_tune_type": "lora",
        "optimizer": args.optimizer,
        "num_layers": args.num_layers,
        "batch_size": args.batch_size,
        "iters": args.iters,
        "val_batches": args.val_batches,
        "test_batches": args.test_batches,
        "learning_rate": args.lr,
        "steps_per_report": args.steps_per_report,
        "steps_per_eval": args.steps_per_eval,
        "grad_accumulation_steps": args.gradient_accumulation,
        "adapter_path": str(adapter_path),
        "save_every": args.save_every,
        "max_seq_length": args.max_seq_len,
        "grad_checkpoint": args.grad_checkpoint,
        "seed": args.seed,
        "mask_prompt": args.mask_prompt,
        "lora_parameters": {
            "rank": args.lora_rank,
            "dropout": args.lora_dropout,
            "scale": args.lora_alpha,
            "keys": args.lora_keys,
        },
    }

    config_path = args.output / "mlx_lora_config.json"
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote MLX config: {config_path}", flush=True)
    print(f"Adapter output: {adapter_path}", flush=True)
    return config_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="FrontAgent Planner MLX LoRA training")
    parser.add_argument("--train-data", type=Path, default=Path("data/train_v2.json"))
    parser.add_argument("--eval-data", type=Path, default=Path("data/eval_v2.json"))
    parser.add_argument("--output", type=Path, default=Path("output-14b-mlx"))
    parser.add_argument("--adapter-path", type=Path, default=None)
    parser.add_argument("--base-model", default=DEFAULT_BASE_MODEL)
    parser.add_argument("--iters", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=4)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--lora-rank", type=int, default=32)
    parser.add_argument("--lora-alpha", type=float, default=64.0)
    parser.add_argument("--lora-dropout", type=float, default=0.0)
    parser.add_argument("--lora-keys", nargs="+", default=DEFAULT_LORA_KEYS)
    parser.add_argument("--num-layers", type=int, default=-1, help="MLX layer count, -1 trains all layers")
    parser.add_argument("--max-seq-len", type=int, default=2048)
    parser.add_argument("--val-batches", type=int, default=25)
    parser.add_argument("--test-batches", type=int, default=25)
    parser.add_argument("--steps-per-report", type=int, default=10)
    parser.add_argument("--steps-per-eval", type=int, default=100)
    parser.add_argument("--save-every", type=int, default=100)
    parser.add_argument("--optimizer", default="adam", choices=["adam", "adamw", "muon", "sgd", "adafactor"])
    parser.add_argument("--seed", type=int, default=3407)
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--max-eval-samples", type=int, default=None)
    parser.add_argument("--test-ratio", type=float, default=0.2)
    parser.add_argument("--system-prompt", default=DEFAULT_SYSTEM_PROMPT)
    parser.add_argument("--mask-prompt", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--grad-checkpoint", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--test", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--prepare-only", action="store_true", help="Only write MLX data/config, do not train")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    adapter_path = args.adapter_path or (args.output / "adapter")

    data_dir = prepare_mlx_data(args)
    config_path = write_mlx_config(args, data_dir, adapter_path)
    if args.prepare_only:
        return

    command = [sys.executable, "-m", "mlx_lm", "lora", "--config", str(config_path)]
    print("Running:", " ".join(command), flush=True)
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
