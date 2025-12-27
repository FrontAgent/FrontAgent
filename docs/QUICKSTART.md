# FrontAgent 快速开始

## 一次性安装（仅需一次）

```bash
# 1. 克隆并构建
git clone https://github.com/your-org/frontagent.git
cd frontagent
pnpm install
pnpm build

# 2. 全局安装
npm link

# 3. 配置 LLM
cp CONFIG.example.sh CONFIG.sh
vim CONFIG.sh  # 填入你的 API Key
source CONFIG.sh
```

## 在任意项目中使用

```bash
# 1. 进入你的项目目录
cd /path/to/your-project

# 2. 初始化 SDD 配置
frontagent init

# 3. 编辑 sdd.yaml（根据项目实际情况配置）
vim sdd.yaml

# 4. 验证配置
frontagent validate

# 5. 开始使用
# 查询任务
frontagent run "查找所有使用了 useState 的组件"

# 修改任务
frontagent run "添加 loading 状态到 Button 组件" \
  --type modify \
  --files src/components/Button.tsx

# 创建任务
frontagent run "创建一个 Modal 组件" \
  --type create \
  --files src/components/Modal.tsx
```

## 常用命令

```bash
frontagent init                    # 初始化 SDD 配置
frontagent validate                # 验证当前目录的 sdd.yaml
frontagent run "任务描述"          # 执行任务（默认 query 类型）
frontagent run "任务" --type modify --files path/to/file  # 修改文件
frontagent info                    # 显示系统信息
frontagent --help                  # 查看帮助
```

## 配置 LLM

在 `CONFIG.sh` 中配置：

```bash
export BASE_URL="https://api.anthropic.com"
export MODEL="claude-sonnet-4-20250514"
export API_KEY="your-api-key"
```

然后：

```bash
source CONFIG.sh
frontagent run "你的任务"
```

## 注意事项

- ⚠️ **必须在目标项目目录下运行**（有 sdd.yaml 的目录）
- ⚠️ **每次新开终端需要 `source CONFIG.sh`** 加载 LLM 配置
- ✅ 如果 LLM 调用失败，会自动降级到基于规则的执行
