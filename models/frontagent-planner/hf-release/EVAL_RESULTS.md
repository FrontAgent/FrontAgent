# FrontAgent Planner 7B — 评估结果

- **基座模型:** Qwen/Qwen2.5-Coder-7B
- **微调方式:** QLoRA 4-bit + LoRA SFT (rank=16, alpha=32)
- **训练数据:** ~96 条合成前端任务规划数据
- **训练环境:** Google Colab T4 GPU

## 指标

| 指标 | 结果 |
|------|------|
| JSON 合法率 | 100.0% |
| 完整计划率 | 100.0% |
| 平均步骤数 | 13.9 |
| 平均延迟 | 51833ms |
