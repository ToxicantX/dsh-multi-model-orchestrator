# DSH Multi-model Orchestrator

Configure and run a team of model-backed specialist Agents in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

[English](#english) | [中文](#中文)

## English

### Overview

DSH Multi-model Orchestrator adds an Agent orchestration page to the DSH Web settings. You can create up to 32 specialist Agents, assign an existing DSH model to each one, and give each Agent a clear responsibility.

When a session uses the **Multi-model orchestrator** preset, every configured Agent becomes an independent subagent tool that the primary Agent can delegate work to.

The primary Agent owns requirement analysis, repository inspection, implementation planning, architecture decisions, integration, and final verification. Subagents implement and adjust explicitly assigned code scopes, inspect their own diffs, and run the focused tests, type checks, or builds that cover their changes before handoff. The primary Agent then inspects and integrates the actual artifacts and independently runs the final verification.

### Features

- Create and remove up to 32 specialist Agents.
- Select models already available in DSH.
- Give each Agent a stable ID and development scope.
- Select an optional reasoning effort from the exact levels advertised by the Agent's model.
- Set an optional maximum output-token limit per Agent.
- Delegate independent, non-overlapping implementation tasks to different models in parallel.
- Keep each running session on the Agent configuration it started with.

### Requirements

- DeepSeek Harness 0.1.0-rc.7 or a compatible newer release
- Node.js 22.19 or newer
- At least one model available in DSH **Settings > Models**

### Installation

Install the bundle in the DSH Web profile:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

Install the Agent preset:

~~~powershell
dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

Restart DSH Web after installation and refresh the browser.

When running DSH from a source checkout, use `pnpm dsh` instead of `dsh` in both commands.

### Usage

1. Open DSH Web.
2. Go to **Settings > Agent orchestration**.
3. Select **Add Agent**.
4. Enter an Agent ID and development scope.
5. Select one of the models available in DSH.
6. Optionally select a reasoning effort supported by that model and set the maximum output-token limit.
7. Save the configuration.
8. Create a session with the **Multi-model orchestrator** preset.

Create a new session after changing the Agent roster or model assignments. Sessions that are already running keep their original Agent configuration.

### Agent fields

| Field | Required | Description |
| --- | --- | --- |
| Agent ID | Yes | Stable identity used for the subagent tool name and per-Agent runtime settings, such as `architect` or `reviewer`. |
| Model | Yes | Provider and model selected from the DSH model catalog. |
| Development scope | No | Implementation and adjustment instructions for the Agent. New Agents start with a default responsibility that requires focused tests and diff inspection before handoff; customize it to narrow the implementation scope. It does not determine Agent identity or transfer primary analysis and final verification. |
| Reasoning effort | No | One of the exact effort levels advertised by the selected model; omission uses the model default. |
| Maximum output tokens | No | Positive integer limiting the Agent's generated output. |

### Local development

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
pnpm bundle
pnpm typecheck
pnpm test
~~~

Release management follows [Semantic Versioning](https://semver.org/) (SemVer). Record user-facing changes in [CHANGELOG.md](CHANGELOG.md), create tags as `vX.Y.Z`, and run the local preflight:

~~~powershell
pnpm release:check v0.5.0
~~~

Pushing a matching `vX.Y.Z` tag triggers verification and a GitHub Release with generated notes. npm publishing is not automatic.

Install a local checkout into a DSH source profile:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
pnpm dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

## 中文

### 项目介绍

DSH Multi-model Orchestrator 为 DeepSeek Harness Web 设置页增加了 Agent 编排功能。你可以创建最多 32 个专业 Agent，为每个 Agent 选择 DSH 中已有的模型，并设置清晰的职责。

Session 使用 **Multi-model orchestrator** 预设后，每个已配置的 Agent 都会成为独立的子 Agent 工具，供主 Agent 按任务需要进行委派。

主 Agent 负责需求分析、代码库检查、实现规划、架构决策、改动集成和最终验证。子 Agent 只实现和调整明确分配的代码范围，交付前检查自己的 diff，并运行覆盖其改动的局部测试、类型检查或构建。主 Agent 随后检查并集成实际产物，再独立执行最终验证。

### 功能特性

- 创建和删除最多 32 个专业 Agent。
- 直接选择 DSH 中已有的模型。
- 为每个 Agent 设置固定 ID 和开发职责。
- 从对应模型实际提供的等级中选择可选推理等级。
- 为每个 Agent 设置可选的最大输出 Token。
- 将独立任务并行委派给不同模型。
- 运行中的 Session 保持启动时的 Agent 配置。

### 环境要求

- DeepSeek Harness 0.1.0-rc.7 或兼容的新版本
- Node.js 22.19 或更高版本
- DSH **设置 > 模型** 中至少有一个可用模型

### 安装

将插件安装到 DSH Web profile：

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

安装 Agent 预设：

~~~powershell
dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

安装完成后重启 DSH Web，并刷新浏览器。

如果通过 DSH 源码仓库运行，请将以上命令中的 `dsh` 替换为 `pnpm dsh`。

### 使用方法

1. 打开 DSH Web。
2. 进入 **设置 > Agent 编排**。
3. 点击 **添加 Agent**。
4. 填写 Agent ID 和开发职责。
5. 从 DSH 可用模型中选择一个模型。
6. 根据需要选择该模型支持的推理等级并设置最大输出 Token。
7. 保存配置。
8. 使用 **Multi-model orchestrator** 预设创建 Session。

修改 Agent 列表或模型分配后，请创建新的 Session。已经运行的 Session 会继续使用启动时的 Agent 配置。

### Agent 配置项

| 配置项 | 必填 | 说明 |
| --- | --- | --- |
| Agent ID | 是 | 用于子 Agent 工具名称和逐 Agent 运行配置的稳定身份，例如 `architect` 或 `reviewer`。 |
| 模型 | 是 | 从 DSH 模型目录中选择的 Provider 和 Model。 |
| 开发职责 | 否 | Agent 的实现和调整范围。新建 Agent 会自动填写默认职责，要求交付前检查 diff 并运行局部验证；可继续修改以缩小实现范围。该字段不用于确定身份，也不转移主 Agent 的分析和最终验证责任。 |
| 推理等级 | 否 | 所选模型实际提供的推理等级之一；省略时使用模型默认值。 |
| 最大输出 Token | 否 | 限制 Agent 输出长度的正整数。 |

### 本地开发

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
pnpm bundle
pnpm typecheck
pnpm test
~~~

发布管理遵循[语义化版本](https://semver.org/)（SemVer）。请在 [CHANGELOG.md](CHANGELOG.md) 记录面向用户的变更，使用 `vX.Y.Z` 格式创建 tag，并运行本地预检：

~~~powershell
pnpm release:check v0.5.0
~~~

推送匹配的 `vX.Y.Z` tag 会触发验证并创建带自动生成说明的 GitHub Release。npm 发布不会自动执行。

将本地仓库安装到 DSH 源码 profile：

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
pnpm dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

## License

MIT
