---
base_model: unsloth/qwen2.5-coder-7b-bnb-4bit
library_name: peft
pipeline_tag: text-generation
tags:
- base_model:adapter:unsloth/qwen2.5-coder-7b-bnb-4bit
- lora
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

# FrontAgent Planner 7B (LoRA Adapter)

基于 Qwen2.5-Coder-7B 微调的前端任务规划 LoRA adapter，从 [FrontAgent](https://github.com/ceilf6/FrontAgent) 的 Planner 阶段蒸馏而来，能够根据自然语言任务描述生成结构化的前端开发执行计划。

## Model Details

### Model Description

- **Developed by:** ceilf6
- **Model type:** LoRA adapter for causal language model
- **Language(s):** 中文, English
- **License:** Apache 2.0 (同基座模型)
- **Finetuned from model:** unsloth/qwen2.5-coder-7b-bnb-4bit (Qwen/Qwen2.5-Coder-7B)

### Model Sources

- **Repository:** https://github.com/ceilf6/FrontAgent/tree/develop/models/frontagent-planner
- **基座模型:** https://huggingface.co/Qwen/Qwen2.5-Coder-7B

## Uses

### Direct Use

输入一个前端开发任务描述和项目上下文，模型输出结构化的 JSON 执行计划，包含：
- 按阶段组织的步骤列表（阶段1-分析 到 阶段7-仓库管理）
- 每个步骤的 description、action、phase 字段
- 风险分析 (risks) 和备选方案 (alternatives)

### Out-of-Scope Use

- 不适用于非前端工程的通用规划任务
- 不应作为生产环境的自动化执行引擎，生成的计划需人工审核

## Bias, Risks, and Limitations

- 训练数据为合成数据（Claude API 生成），可能无法覆盖所有真实场景
- 7B 模型在复杂多步骤任务上的推理能力有限
- 输出的 JSON 结构可能不完全稳定，建议后处理校验

## How to Get Started with the Model

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = "Qwen/Qwen2.5-Coder-7B"
adapter = "ceilf6/frontagent-planner-7B-lora"

tokenizer = AutoTokenizer.from_pretrained(base_model)
model = AutoModelForCausalLM.from_pretrained(base_model, torch_dtype="auto", device_map="auto")
model = PeftModel.from_pretrained(model, adapter)

messages = [
    {"role": "system", "content": "你是一个资深前端工程师和项目规划专家。请根据以下任务描述和项目上下文，生成一个结构化的执行计划。计划应按阶段组织（阶段1-分析、阶段2-创建、阶段3-安装、阶段4-验证、阶段5-启动、阶段6-浏览器验证、阶段7-仓库管理），每个步骤包含 description（描述）、action（动作类型）、phase（所属阶段）。同时提供 risks（潜在风险）和 alternatives（备选方案）。\n\n可用的动作类型: read_file, list_directory, create_file, apply_patch, search_code, get_ast, run_command, browser_navigate, browser_screenshot, get_page_structure, browser_click, browser_type"},
    {"role": "user", "content": "任务：创建一个用户登录页面，包含邮箱和密码输入框，支持表单验证\n\n项目上下文：\nReact 18 + TypeScript + Ant Design 5"},
]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(text, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=1536, temperature=0.7, top_p=0.9)
response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
print(response)
```

## Training Details

### Training Data

由 Claude API 基于 FrontAgent 的 Planner 系统提示词合成的 ~100 条前端任务规划数据，覆盖创建、修改、分析三类任务场景，Alpaca 格式 (instruction/input/output)。

### Training Hyperparameters

- **Training framework:** Unsloth 2x fast finetuning
- **Base model:** Qwen/Qwen2.5-Coder-7B (4-bit quantized)
- **Method:** QLoRA (4-bit) + LoRA SFT
- **LoRA rank:** 16
- **LoRA alpha:** 32
- **Target modules:** q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
- **Learning rate:** 1e-4
- **Epochs:** 5
- **Batch size:** 2
- **Gradient accumulation:** 4
- **Max sequence length:** 1024
- **Optimizer:** AdamW 8-bit
- **LR scheduler:** Cosine
- **Warmup ratio:** 0.05

### Speeds, Sizes, Times

- **Training hardware:** Google Colab T4 GPU (16GB VRAM)
- **Training time:** ~45-90 分钟
- **Adapter size:** ~50MB
- **可训练参数:** 80,740,352 / 4,433,712,640 (1.82%)

## Evaluation

### Metrics

- **JSON 合法率:** 模型输出是否为合法 JSON
- **完整计划率:** 是否包含 phases/steps/risks/alternatives
- **步骤数:** 每个计划包含的步骤数量

## Framework versions

- PEFT 0.19.1
- Transformers 5.5.0
- Unsloth 2026.5.2
- TRL (SFTTrainer)
- Torch 2.10.0+cu128
