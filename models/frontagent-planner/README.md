# FrontAgent Planner Model

This directory contains the training and release assets for the distilled FrontAgent Planner model.

The model is a LoRA adapter trained from FrontAgent's Planner stage. It turns natural-language frontend engineering tasks and project context into structured execution plans, matching the phase-based workflow used by FrontAgent.

## Contents

- `prompts/` - Planner and error-recovery prompts extracted from FrontAgent.
- `data/` - Synthetic Alpaca-format training data and generation script.
- `train.py` - Unsloth QLoRA SFT training script.
- `eval.py` - Inference and JSON-structure evaluation script.
- `publish.py` - Hugging Face Hub upload script for the LoRA adapter.
- `colab_train.ipynb` - Colab workflow for training, evaluation, and publishing.
- `hf-release/` - Hugging Face model card, tokenizer metadata, adapter config, and evaluation summary.
- `plan.md` - Original distillation plan and workflow notes.

## Hugging Face Release

- Model adapter: [ceilf6/frontagent-planner-7B-lora](https://huggingface.co/ceilf6/frontagent-planner-7B-lora)
- Base model: [Qwen/Qwen2.5-Coder-7B](https://huggingface.co/Qwen/Qwen2.5-Coder-7B)

Load the adapter on top of Qwen2.5-Coder-7B when you want a local Planner-only path that does not call large LLM APIs.

## Colab Quick Start

```bash
git clone https://github.com/ceilf6/FrontAgent.git
cd FrontAgent/models/frontagent-planner
python train.py --base-model Qwen/Qwen2.5-Coder-7B --data data/train.json --output output --epochs 5 --lr 1e-4 --batch-size 2 --lora-rank 16 --max-seq-len 1024
python eval.py --base-model Qwen/Qwen2.5-Coder-7B --adapter output/lora_adapter --output eval_results.json --compare-base
python publish.py --adapter output/lora_adapter --repo-id ceilf6/frontagent-planner-7B-lora
```

## Scope

These files are repository assets for model training and publication. They are intentionally kept outside `packages/` and are not part of the FrontAgent runtime or npm publish surface.
