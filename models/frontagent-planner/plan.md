# Plan: 基于 FrontAgent 训练 Planner 模型并发布到 Hugging Face

## Context

用户希望训练一个自定义模型发布到 Hugging Face (https://huggingface.co/ceilf6)。结合 FrontAgent（一个前端工程 AI Agent 系统）的提示词和能力，将开源模型微调为前端任务规划专家。

FrontAgent 核心价值：丰富的系统提示词（planner、code gen、error recovery）、结构化输出（Zod schema）、技能模板（frontend-design、frontend-reviewer、requirement-interviewer）。

---

## 方案：SFT 微调 — FrontAgent Planner 蒸馏

**目标**：微调一个小型开源模型，学习从自然语言任务描述生成结构化的前端执行计划（模拟 FrontAgent 的 Planner 阶段）。

**基座模型**：`Qwen/Qwen2.5-Coder-7B`（通过 QLoRA 4-bit 在 Colab T4 上训练，Apache 2.0 许可）

---

### Step 1: 从 FrontAgent 提取提示词和 Schema

**来源文件**：
- `packages/core/src/llm.ts` — Planner 系统提示词（~L594-649）、Code Gen 提示词（~L987-1007）、Error Recovery 提词（~L1274-1406）
- `packages/core/src/types.ts` — Zod schema 定义（Plan 结构、Step 结构、Phase 类型）
- `skills/frontend-design/SKILL.md` — 前端设计技能模板
- `skills/requirement-interviewer/SKILL.md` — 需求访谈模板

**产出**：`models/frontagent-planner/prompts/` 目录下整理好的提示词文件

### Step 2: 生成合成训练数据

**方法**：用 Claude API + Step 1 提取的提示词，批量生成 (task_description → structured_plan) 的训练对。

- 定义 50-100 个前端任务场景（创建登录页、添加表单验证、重构组件等）
- 每个任务通过 FrontAgent Planner 提示词生成对应的结构化计划
- 输出格式：Alpaca 格式（instruction / input / output）

```json
{
  "instruction": "你是一个资深前端工程师，请为以下任务生成执行计划...",
  "input": "创建一个用户登录页面，包含邮箱和密码输入框，支持表单验证",
  "output": "{\"phases\": [{\"name\": \"analysis\", \"steps\": [...]}], ...}"
}
```

**产出**：`models/frontagent-planner/data/train.json` + 可选 eval 数据

### Step 3: 微调训练

**框架**：Unsloth（Colab 免费 T4 GPU 可用，训练速度 2x 加速）

**关键参数**：
- LoRA rank=16, alpha=32
- learning_rate=2e-4
- epochs=3
- max_seq_length=2048
- batch_size=4, gradient_accumulation=4

**产出**：`models/frontagent-planner/train.py` 训练脚本 + LoRA adapter 权重

### Step 4: 推理验证

用 5-10 个未见过的任务测试微调后的模型，对比：
- 能否生成合法的 JSON 结构
- 计划的完整性和合理性
- 与原始 FrontAgent Planner 输出的相似度

**产出**：`models/frontagent-planner/eval.py` 评估脚本 + 对比结果

### Step 5: 发布到 HuggingFace

- 合并 LoRA 权重到基座模型
- 创建 HuggingFace Model Card（中文 README，说明模型用途、训练方式、使用示例）
- 用 `huggingface_hub` CLI 推送到 `ceilf6/frontagent-planner-7B-lora`

**产出**：发布到 https://huggingface.co/ceilf6/frontagent-planner-7B-lora

---

## 目录结构

```
models/frontagent-planner/
├── README.md              # FrontAgent 仓库内的模型入口说明
├── prompts/               # 从 FrontAgent 提取的提示词
│   ├── planner-prompt.md
│   └── error-recovery-prompt.md
├── data/                  # 合成训练数据
│   ├── generate_data.py   # 数据生成脚本
│   └── train.json
├── train.py               # Unsloth 微调脚本
├── eval.py                # 推理评估脚本
├── publish.py             # HuggingFace 发布脚本
├── colab_train.ipynb      # Colab 训练/评估/发布流程
└── hf-release/            # Hugging Face 发布元数据和评估摘要
```

## 验证方式

1. 训练 loss 曲线正常下降
2. `eval.py` 输出的 JSON 结构合法率 > 90%
3. 人工评估 5 个样例的计划质量
4. HuggingFace 模型页面可访问，推理示例正常
