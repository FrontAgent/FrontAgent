"""
FrontAgent Planner — Unsloth SFT 微调脚本

基座模型: Qwen/Qwen2.5-Coder-7B
训练数据: data/train.json (Alpaca 格式)
运行环境: Colab T4 (16GB VRAM)
"""

import json
import os
import argparse
from pathlib import Path

import torch
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from datasets import Dataset
from transformers import TrainingArguments
from trl import SFTTrainer


# ─── 超参数 ───────────────────────────────────────────────
BASE_MODEL = "Qwen/Qwen2.5-Coder-7B"
MAX_SEQ_LENGTH = 2048
LORA_RANK = 16
LORA_ALPHA = 32
LEARNING_RATE = 2e-4
EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4
WARMUP_RATIO = 0.05
LOGGING_STEPS = 10
SAVE_STEPS = 200


def load_alpaca_data(data_path: str) -> Dataset:
    """加载 Alpaca 格式的 JSON 训练数据"""
    with open(data_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # 转为 HuggingFace Dataset
    ds = Dataset.from_list(raw)
    print(f"加载训练数据: {len(ds)} 条")
    return ds


def format_alpaca_to_chat(example: dict, tokenizer) -> dict:
    """将 Alpaca 格式转为 ChatML 格式并 tokenize"""
    instruction = example["instruction"]
    input_text = example.get("input", "")
    output_text = example["output"]

    if input_text:
        user_msg = f"{instruction}\n\n{input_text}"
    else:
        user_msg = instruction

    messages = [
        {"role": "system", "content": "你是一个资深前端工程师和项目规划专家。"},
        {"role": "user", "content": user_msg},
        {"role": "assistant", "content": output_text},
    ]

    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=False
    )
    return {"text": text}


def main():
    parser = argparse.ArgumentParser(description="FrontAgent Planner SFT 训练")
    parser.add_argument("--data", default="data/train.json", help="训练数据路径")
    parser.add_argument("--output", default="output", help="模型输出目录")
    parser.add_argument("--base-model", default=BASE_MODEL, help="基座模型")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--lr", type=float, default=LEARNING_RATE)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--max-seq-len", type=int, default=MAX_SEQ_LENGTH)
    parser.add_argument("--lora-rank", type=int, default=LORA_RANK, help="LoRA rank")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── 1. 加载基座模型 ──────────────────────────────────
    print(f"加载基座模型: {args.base_model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_len,
        dtype=None,  # 自动检测 (T4 用 float16)
        load_in_4bit=True,  # QLoRA 4bit 量化，T4 友好
    )

    # ── 2. 配置 Chat Template ───────────────────────────
    tokenizer = get_chat_template(
        tokenizer,
        chat_template="chatml",  # Qwen 使用 ChatML 格式
    )

    # ── 3. 注入 LoRA ────────────────────────────────────
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_rank,
        lora_alpha=args.lora_rank * 2,
        lora_dropout=0,  # Unsloth 建议设 0 加速
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        bias="none",
        use_gradient_checkpointing="unsloth",  # 省显存
        random_state=3407,
    )

    # 打印可训练参数
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"可训练参数: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

    # ── 4. 加载 & 处理数据 ───────────────────────────────
    ds = load_alpaca_data(args.data)
    ds = ds.map(
        lambda ex: format_alpaca_to_chat(ex, tokenizer),
        remove_columns=ds.column_names,
    )
    print(f"示例文本 (前 500 字符):\n{ds[0]['text'][:500]}...")

    # ── 5. 训练参数 ─────────────────────────────────────
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        learning_rate=args.lr,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=LOGGING_STEPS,
        save_steps=SAVE_STEPS,
        warmup_ratio=WARMUP_RATIO,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        seed=3407,
        report_to="none",  # 不上报到 wandb 等
    )

    # ── 6. 开始训练 ─────────────────────────────────────
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        args=training_args,
        max_seq_length=args.max_seq_len,
        dataset_text_field="text",
        packing=True,  # 序列打包，提升 GPU 利用率
    )

    print("开始训练...")
    trainer.train()

    # ── 7. 保存 LoRA adapter ────────────────────────────
    adapter_path = output_dir / "lora_adapter"
    model.save_pretrained(str(adapter_path))
    tokenizer.save_pretrained(str(adapter_path))
    print(f"LoRA adapter 已保存到: {adapter_path}")

    # ── 8. 可选: 保存 GGUF 量化版本 ─────────────────────
    # model.save_pretrained_gguf(output_dir / "gguf", tokenizer, quantization_method="q4_k_m")
    # print("GGUF 量化模型已保存")


if __name__ == "__main__":
    main()
