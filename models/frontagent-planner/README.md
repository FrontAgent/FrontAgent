# FrontAgent Planner Model

This directory contains the training, evaluation, and release assets for distilled FrontAgent Planner models.

The Planner model turns natural-language frontend engineering tasks plus project context into structured execution plans. It is a Planner-only adapter: it should not generate business code directly, and its output still needs schema validation and FrontAgent post-processing before execution.

## Model Tracks

| Track | Adapter | Base model | Purpose |
| --- | --- | --- | --- |
| 7B lightweight | `ceilf6/frontagent-planner-7B-lora` | `Qwen/Qwen2.5-Coder-7B` | Local lightweight planning and backwards compatibility. |
| 14B quality v2 | `ceilf6/frontagent-planner-14B-lora` | `Qwen/Qwen2.5-Coder-14B-Instruct` | Higher quality planning with larger capacity and v2 data quality gates. |

## Contents

- `prompts/` - Planner and error-recovery prompts extracted from FrontAgent.
- `data/` - Alpaca-format training/eval data and the v2 data generator.
- `train.py` - Unsloth QLoRA SFT training script, defaulting to the 14B v2 track.
- `eval.py` - Schema, action, phase, executability, overplanning, and task-fit evaluator.
- `publish.py` - Hugging Face Hub upload script, defaulting to the 14B adapter repo.
- `hf-release/` - Existing 7B Hugging Face release metadata.
- `hf-release-14b/` - 14B v2 model card, adapter config template, and evaluation summary.
- `plan.md` - Original distillation plan and workflow notes.

## Build v2 Data

Offline deterministic generation is the default so the dataset can be rebuilt without external services:

```bash
cd models/frontagent-planner
python data/generate_data.py --train-count 500 --eval-count 100 --output-dir data
python data/generate_data.py --validate-only data/train_v2.json data/eval_v2.json
```

When a teacher model is available, use teacher mode. `ANTHROPIC_AUTH_TOKEN` is supported in addition to `ANTHROPIC_API_KEY`.

```bash
export ANTHROPIC_BASE_URL="http://your-teacher-endpoint"
export ANTHROPIC_AUTH_TOKEN="..."
export ANTHROPIC_MODEL="gpt-5.5"
python data/generate_data.py --mode teacher --train-count 500 --eval-count 100 --output-dir data
```

## Train

14B quality track:

```bash
python train.py \
  --base-model Qwen/Qwen2.5-Coder-14B-Instruct \
  --data data/train_v2.json \
  --output output-14b \
  --epochs 3 \
  --lr 1e-4 \
  --batch-size 1 \
  --gradient-accumulation 4 \
  --lora-rank 32 \
  --lora-alpha 64 \
  --max-seq-len 2048
```

Training smoke with the first 20 samples:

```bash
python train.py --data data/train_v2.json --output output-14b-smoke --max-samples 20 --epochs 1
```

Legacy 7B track:

```bash
python train.py \
  --base-model Qwen/Qwen2.5-Coder-7B \
  --data data/train.json \
  --output output-7b \
  --epochs 5 \
  --lr 1e-4 \
  --batch-size 2 \
  --lora-rank 16 \
  --lora-alpha 32 \
  --max-seq-len 1024
```

## Evaluate

Score stored plans without loading a model:

```bash
python eval.py --score-only --eval-data data/eval_v2.json --output eval_results_v2.json
```

Evaluate the 14B adapter:

```bash
python eval.py \
  --base-model Qwen/Qwen2.5-Coder-14B-Instruct \
  --adapter output-14b/lora_adapter \
  --eval-data data/eval_v2.json \
  --output eval_results_14b.json
```

The v2 quality gate tracks strict schema validity, action enum validity, phase validity, executability, overplanning penalty, and task-fit score. A release candidate should keep strict schema/action validity at 100% and materially improve average quality score over the 7B baseline.

## Publish

```bash
python publish.py --adapter output-14b/lora_adapter --repo-id ceilf6/frontagent-planner-14B-lora
```

Use explicit arguments to publish or update the legacy 7B adapter.
