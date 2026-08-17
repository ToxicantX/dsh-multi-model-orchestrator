# DSH Multi-model Orchestrator

Configure and run a team of model-backed specialist Agents in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

[English](#english) | [中文](#中文)

## English

### Overview

DSH Multi-model Orchestrator adds an Agent orchestration page to the DSH Web settings. You can create any number of specialist Agents, assign an existing DSH model to each one, and give each Agent a clear responsibility.

When a session uses the **Multi-model orchestrator** preset, every configured Agent becomes an independent subagent tool that the primary Agent can delegate work to.

### Features

- Create and remove any number of specialist Agents.
- Select models already available in DSH.
- Give each Agent a stable ID and role description.
- Set an optional maximum output-token limit per Agent.
- Delegate independent work to different models in parallel.
- Keep each running session on the Agent configuration it started with.

### Requirements

- DeepSeek Harness 0.1.0-rc.5 or a compatible newer release
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
4. Enter an Agent ID and role description.
5. Select one of the models available in DSH.
6. Optionally set the maximum output-token limit.
7. Save the configuration.
8. Create a session with the **Multi-model orchestrator** preset.

Create a new session after changing the Agent roster or model assignments. Sessions that are already running keep their original Agent configuration.

### Agent fields

| Field | Required | Description |
| --- | --- | --- |
| Agent ID | Yes | Unique lowercase identifier used in the subagent tool name, such as `architect` or `reviewer`. |
| Model | Yes | Provider and model selected from the DSH model catalog. |
| Role description | No | The Agent's responsibility and working focus. |
| Maximum output tokens | No | Positive integer limiting the Agent's generated output. |

### Local development

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
pnpm bundle
pnpm test
~~~

Install a local checkout into a DSH source profile:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
pnpm dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

## 中文

### 项目介绍

DSH Multi-model Orchestrator 为 DeepSeek Harness Web 设置页增加了 Agent 编排功能。你可以创建任意数量的专业 Agent，为每个 Agent 选择 DSH 中已有的模型，并设置清晰的职责。

Session 使用 **Multi-model orchestrator** 预设后，每个已配置的 Agent 都会成为独立的子 Agent 工具，供主 Agent 按任务需要进行委派。

### 功能特性

- 创建和删除任意数量的专业 Agent。
- 直接选择 DSH 中已有的模型。
- 为每个 Agent 设置固定 ID 和职责描述。
- 为每个 Agent 设置可选的最大输出 Token。
- 将独立任务并行委派给不同模型。
- 运行中的 Session 保持启动时的 Agent 配置。

### 环境要求

- DeepSeek Harness 0.1.0-rc.5 或兼容的新版本
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
4. 填写 Agent ID 和职责描述。
5. 从 DSH 可用模型中选择一个模型。
6. 根据需要设置最大输出 Token。
7. 保存配置。
8. 使用 **Multi-model orchestrator** 预设创建 Session。

修改 Agent 列表或模型分配后，请创建新的 Session。已经运行的 Session 会继续使用启动时的 Agent 配置。

### Agent 配置项

| 配置项 | 必填 | 说明 |
| --- | --- | --- |
| Agent ID | 是 | 用于子 Agent 工具名称的唯一小写标识，例如 `architect` 或 `reviewer`。 |
| 模型 | 是 | 从 DSH 模型目录中选择的 Provider 和 Model。 |
| 职责描述 | 否 | Agent 负责的任务范围和工作重点。 |
| 最大输出 Token | 否 | 限制 Agent 输出长度的正整数。 |

### 本地开发

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
pnpm bundle
pnpm test
~~~

将本地仓库安装到 DSH 源码 profile：

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
pnpm dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

## License

MIT
