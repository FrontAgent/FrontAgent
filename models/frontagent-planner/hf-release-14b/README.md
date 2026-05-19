---
base_model: Qwen/Qwen2.5-Coder-14B-Instruct
library_name: peft
pipeline_tag: text-generation
tags:
- base_model:adapter:Qwen/Qwen2.5-Coder-14B-Instruct
- lora
- qlora
- sft
- transformers
- trl
- unsloth
- frontend
- agent
- planner
- code-generation
language:
- zh
- en
---

# FrontAgent Planner 14B (LoRA Adapter)

FrontAgent Planner 14B is the quality-focused v2 Planner adapter distilled from FrontAgent planning workflows. It is trained to generate structured frontend engineering execution plans from a user task and project context.

This is a Planner-only adapter. It does not directly generate application code, run tools, or make repository changes. The generated plan should be validated against the FrontAgent schema and reviewed or post-processed before execution.

## Model Details

- **Developed by:** ceilf6
- **Model type:** LoRA adapter for causal language model
- **Base model:** `Qwen/Qwen2.5-Coder-14B-Instruct`
- **Language:** Chinese and English
- **Primary use:** Frontend engineering task planning for FrontAgent

## Intended Use

Input:

- natural-language frontend engineering task
- project context, such as framework, directory layout, known files, SDD constraints, or retrieved knowledge

Output:

- JSON object with `summary`, `stepOutlines`, `risks`, and `alternatives`
- each step contains `description`, `action`, and `phase`
- `action` must be one of FrontAgent's planner action enum values

## Training Data

The v2 data pipeline expands beyond the original 7B release:

- at least 500 generated training samples
- held-out eval set
- strict sample validation before write
- action enum checks
- unresolved placeholder rejection
- non-empty risk and alternative requirements
- support for curated golden samples and real FrontAgent run samples

## Training Recipe

Recommended command:

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

## Evaluation

The v2 evaluator reports:

- strict schema validity
- action enum validity
- phase validity
- executability score
- overplanning penalty
- task-fit score
- aggregate quality score

Release gate:

- strict schema validity: 100%
- action enum validity: 100%
- average quality score materially above the 7B baseline
- complex task success rate materially above the 7B baseline

## Usage

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = "Qwen/Qwen2.5-Coder-14B-Instruct"
adapter = "ceilf6/frontagent-planner-14B-lora"

tokenizer = AutoTokenizer.from_pretrained(base_model)
model = AutoModelForCausalLM.from_pretrained(base_model, torch_dtype="auto", device_map="auto")
model = PeftModel.from_pretrained(model, adapter)

messages = [
    {"role": "system", "content": "你是一个资深前端工程师和项目规划专家。只输出 FrontAgent Planner JSON。"},
    {"role": "user", "content": "任务：创建一个用户登录页面，包含邮箱和密码输入框，支持表单验证\n\n项目上下文：React 18 + TypeScript + Ant Design 5"},
]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(text, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=1536, temperature=0.2, top_p=0.9)
print(tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True))
```

## Limitations

- Plans still require schema validation and execution-time safety checks.
- The adapter is optimized for frontend engineering planning, not general reasoning.
- Generated paths and commands must be verified against the target repository before execution.
