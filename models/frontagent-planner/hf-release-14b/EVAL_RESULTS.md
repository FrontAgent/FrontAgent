# FrontAgent Planner 14B — v2 Evaluation Summary

This file tracks the release gates for `ceilf6/frontagent-planner-14B-lora`.

## Baseline

| Item | Value |
| --- | --- |
| Legacy adapter | `ceilf6/frontagent-planner-7B-lora` |
| Legacy base model | `Qwen/Qwen2.5-Coder-7B` |
| Legacy training data | ~96 synthetic samples |
| Legacy reported checks | JSON validity and complete-plan rate |

## 14B v2 Target

| Item | Value |
| --- | --- |
| Adapter | `ceilf6/frontagent-planner-14B-lora` |
| Base model | `Qwen/Qwen2.5-Coder-14B-Instruct` |
| Training data | `data/train_v2.json` (500 samples) |
| Eval data | `data/eval_v2.json` (100 samples) |
| LoRA rank / alpha | 32 / 64 |

## Current Data Gate

Generated with:

```bash
python data/generate_data.py --train-count 500 --eval-count 100 --output-dir data
python data/generate_data.py --validate-only data/train_v2.json data/eval_v2.json
python eval.py --score-only --eval-data data/eval_v2.json --output eval_results_v2.json
```

| Check | Result |
| --- | ---: |
| train samples | 500 |
| eval samples | 100 |
| train validation errors | 0 |
| eval validation errors | 0 |
| eval strict schema validity | 100.0% |
| eval action enum validity | 100.0% |
| eval phase validity | 100.0% |
| eval average quality score | 0.999 |
| eval average task-fit score | 0.998 |
| eval overplanning penalty | 0.000 |

## Release Gates

| Metric | Required |
| --- | ---: |
| strict schema validity | 100% |
| action enum validity | 100% |
| average quality score | at least 15% above 7B baseline |
| complex task success rate | at least 20% above 7B baseline |

The current numbers above validate the v2 data and scoring pipeline. Replace or extend them with measured 14B LoRA inference numbers after training.

## How To Generate Final Numbers

```bash
python eval.py --score-only --eval-data data/eval_v2.json --output eval_results_v2_teacher.json
python eval.py --base-model Qwen/Qwen2.5-Coder-14B-Instruct --base-only --eval-data data/eval_v2.json --output eval_results_14b_base.json
python eval.py --base-model Qwen/Qwen2.5-Coder-14B-Instruct --adapter output-14b/lora_adapter --eval-data data/eval_v2.json --output eval_results_14b_lora.json
```

Publish only after `eval_results_14b_lora.json` satisfies the release gates.
