"""
FrontAgent Planner — 本地推理 (GGUF + llama-cpp-python)

使用 GGUF 量化模型 + LoRA adapter 在 Mac 上低内存运行。
安装: pip install llama-cpp-python huggingface-hub
"""

import json
from pathlib import Path
from huggingface_hub import hf_hub_download
from llama_cpp import Llama

# ─── 模型配置 ─────────────────────────────────────────────
# Qwen2.5-Coder-7B 的 GGUF 量化版本
GGUF_REPO = "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
GGUF_FILE = "qwen2.5-coder-7b-instruct-q4_k_m.gguf"  # ~4.5GB, Mac 友好

# LoRA adapter (需要转换为 llama.cpp 格式)
# 如果未转换，会跳过 LoRA 加载，直接用基座模型测试
ADAPTER_REPO = "ceilf6/frontagent-planner-7B-lora"

CACHE_DIR = Path(__file__).parent / "models"
CACHE_DIR.mkdir(exist_ok=True)


def load_model():
    """下载并加载 GGUF 模型"""
    model_path = hf_hub_download(
        repo_id=GGUF_REPO,
        filename=GGUF_FILE,
        cache_dir=str(CACHE_DIR),
    )
    print(f"Model loaded: {model_path}")

    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=-1,  # -1 = 全部卸载到 Metal (Apple Silicon)
        verbose=False,
    )
    return llm


SYSTEM_PROMPT = (
    "你是一个资深前端工程师和项目规划专家。请根据以下任务描述和项目上下文，"
    "生成一个结构化的执行计划。计划应按阶段组织（阶段1-分析、阶段2-创建、"
    "阶段3-安装、阶段4-验证、阶段5-启动、阶段6-浏览器验证、阶段7-仓库管理），"
    "每个步骤包含 description（描述）、action（动作类型）、phase（所属阶段）。"
    "同时提供 risks（潜在风险）和 alternatives（备选方案）。\n\n"
    "可用的动作类型: read_file, list_directory, create_file, apply_patch, "
    "search_code, get_ast, run_command, browser_navigate, browser_screenshot, "
    "get_page_structure, browser_click, browser_type"
)


def generate(llm, task: str, context: str = "", max_tokens: int = 1536) -> str:
    """生成执行计划"""
    user_msg = f"任务：{task}"
    if context:
        user_msg += f"\n\n项目上下文：\n{context}"

    output = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=max_tokens,
        temperature=0.7,
        top_p=0.9,
    )
    return output["choices"][0]["message"]["content"]


if __name__ == "__main__":
    llm = load_model()

    # 测试
    task = "创建一个用户登录页面，包含邮箱和密码输入框，支持表单验证"
    context = "React 18 + TypeScript + Ant Design 5"

    print(f"\nTask: {task}\nContext: {context}\n")
    print("Generating...\n")

    result = generate(llm, task, context)
    print(result)
