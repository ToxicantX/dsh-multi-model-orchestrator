# DSH Multi-model Orchestrator

Configure and run a team of model-backed specialist Agents in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

[English](#english) | [中文](#中文)

## English

### Overview

DSH Multi-model Orchestrator adds an Agent orchestration page to the DSH Web settings. You can create up to 32 specialist Agents, assign an existing DSH model to each one, and give each Agent a clear responsibility.

When a session uses the **Multi-model orchestrator** preset, every configured Agent becomes an independent subagent tool that the primary Agent can delegate work to.

The primary Agent uses configured specialists actively and remains responsible for the integrated result. Non-trivial work delegates at least one separable implementation, review, or investigation task, while truly small changes can stay local. Independent tasks can run in parallel, dependent work stays ordered, and follow-up changes reuse the same continuable child without duplicating delegated work.

### Features

- Create and remove up to 32 specialist Agents.
- Select models already available in DSH.
- Give each Agent a stable ID and development scope.
- Select an optional reasoning effort from the exact levels advertised by the Agent's model.
- Set an optional maximum output-token limit per Agent.
- Delegate at least one separable specialist task for non-trivial work, while keeping truly small changes local.
- Run independent work in parallel, keep dependent work ordered, and reuse continuable children for follow-ups.
- Keep each running session on the Agent configuration it started with.

### Requirements

- DeepSeek Harness 0.1.0-rc.7 or a compatible newer release
- Node.js 22.19 or newer
- At least one model available in DSH **Settings > Models**

### Installation

Install the plugin in the DSH Web profile:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

Restart DSH Web after installation and refresh the browser. The plugin provisions and maintains its Agent preset automatically when the Host starts. It also provisions the legacy `orchestrator` preset ID so existing sessions created with that ID can resume while hiding official-name compatibility entries from Web selection lists. Exact official pre-marker copies are adopted safely; customized user-managed presets are never overwritten and remain visible when given a distinct name.

When running DSH from a source checkout, use `pnpm dsh` instead of `dsh` in the command.

If startup reports that the managed preset was edited or conflicts with an existing preset, and you intend to discard those local changes, repair it explicitly:

~~~powershell
dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

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
| Development scope | No | Task guidance for the Agent. New Agents start with a concise responsibility covering focused changes, appropriate checks, and clear reporting; customize it for the work the Agent handles. It does not determine Agent identity. |
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
pnpm release:check v0.6.3
~~~

Pushing a matching `vX.Y.Z` tag triggers verification and a GitHub Release with generated notes. npm publishing is not automatic.

Install a local checkout into a DSH source profile:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
~~~

## 中文

### 项目介绍

DSH Multi-model Orchestrator 为 DeepSeek Harness Web 设置页增加了 Agent 编排功能。你可以创建最多 32 个专业 Agent，为每个 Agent 选择 DSH 中已有的模型，并设置清晰的职责。

Session 使用 **Multi-model orchestrator** 预设后，每个已配置的 Agent 都会成为独立的子 Agent 工具，供主 Agent 按任务需要进行委派。

主 Agent 主动使用已配置的 specialist，并对集成结果负责。非简单工作至少委派一个可独立实现、审查或调查的子任务，真正的一步小改仍可由主 Agent 直接完成。独立任务可以并行，依赖任务保持有序，同一任务的后续修改复用已有的可继续子 Agent，且主 Agent 不重复执行已委派范围。

### 功能特性

- 创建和删除最多 32 个专业 Agent。
- 直接选择 DSH 中已有的模型。
- 为每个 Agent 设置固定 ID 和开发职责。
- 从对应模型实际提供的等级中选择可选推理等级。
- 为每个 Agent 设置可选的最大输出 Token。
- 非简单工作至少委派一个可独立 specialist 子任务，真正的小改仍可直接完成。
- 并行处理独立任务，有序处理依赖任务，并为后续修改复用可继续子 Agent。
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

安装完成后重启 DSH Web，并刷新浏览器。Host 启动时，插件会自动预置并维护 Agent 预设，同时创建旧版 `orchestrator` 兼容 ID，使使用该 ID 的已有 Session 可以恢复，并从 Web 选择列表中隐藏使用官方显示名的兼容项。内容完全匹配官方旧版的无 marker preset 会被安全收编；经过自定义的用户 preset 不会被覆盖，改用不同名称时仍保持可见。

如果通过 DSH 源码仓库运行，请将命令中的 `dsh` 替换为 `pnpm dsh`。

如果启动时提示受管预设已被修改或与现有预设冲突，并且你确认要丢弃这些本地改动，请显式修复：

~~~powershell
dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

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
| 开发职责 | 否 | Agent 的任务指引。新建 Agent 会自动填写精简职责，要求聚焦改动、按需检查并清晰报告；可根据 Agent 承担的工作调整。该字段不用于确定身份。 |
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
pnpm release:check v0.6.3
~~~

推送匹配的 `vX.Y.Z` tag 会触发验证并创建带自动生成说明的 GitHub Release。npm 发布不会自动执行。

将本地仓库安装到 DSH 源码 profile：

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
~~~

## License

MIT
