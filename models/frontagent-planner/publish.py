"""
FrontAgent Planner — HuggingFace 发布脚本

直接上传 LoRA adapter 到 HuggingFace Hub（无需下载基座模型）
"""

import argparse
import os

from huggingface_hub import HfApi, login


def main():
    parser = argparse.ArgumentParser(description="发布 LoRA adapter 到 HuggingFace")
    parser.add_argument("--adapter", default="output/lora_adapter", help="LoRA adapter 目录")
    parser.add_argument("--repo-id", default="ceilf6/frontagent-planner-7B-lora", help="HuggingFace 仓库 ID")
    parser.add_argument("--hf-token", default=None, help="HuggingFace token (也可用 HF_TOKEN 环境变量)")
    args = parser.parse_args()

    # 登录
    token = args.hf_token or os.environ.get("HF_TOKEN")
    if token:
        login(token=token)
    else:
        login()

    # 创建仓库并上传
    api = HfApi()
    api.create_repo(repo_id=args.repo_id, repo_type="model", private=False, exist_ok=True)
    api.upload_folder(
        folder_path=args.adapter,
        repo_id=args.repo_id,
        repo_type="model",
    )
    print(f"上传完成: https://huggingface.co/{args.repo_id}")


if __name__ == "__main__":
    main()
