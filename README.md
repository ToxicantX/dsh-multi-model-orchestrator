# DSH Multi-model Orchestrator

Configure and run a team of model-backed specialist Agents in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

[English](#english) | [中文](#中文)

## English

### Overview

DSH Multi-model Orchestrator adds an Agent orchestration page to the DSH Web settings. You can create up to 3 specialist Agents, assign an existing DSH model to each one, and give each Agent a clear responsibility.

When a session uses the **Multi-model orchestrator** preset, every configured Agent becomes an independent subagent tool that the primary Agent can delegate work to.

The primary Agent acts as the product owner and engineering manager rather than the default developer. For non-trivial work, it defines the outcome and acceptance criteria, decomposes non-overlapping scopes, and delegates development, investigation, testing, and review before implementation begins. Each specialist exclusively owns its delegated scope until it settles; the primary coordinates only non-overlapping work, waits on dependencies, integrates returned work, and performs final acceptance. Truly small one-step changes can stay local.

### Features

- Create and remove up to 3 specialist Agents.
- Select models already available in DSH.
- Give each Agent a stable ID and development scope.
- Select an optional reasoning effort from the exact levels advertised by the Agent's model.
- Set an optional maximum output-token limit per Agent.
- Make the primary Agent responsible for requirements, planning, assignment, integration, and final acceptance.
- Give specialists exclusive ownership of delegated development scopes so the primary cannot duplicate their work.
- Map meaningful scopes to the best-fit available specialists, dispatch all independent matches together, wait on dependencies, and reuse continuable children for follow-ups without inventing work to fill capacity.
- Keep each running session on the Agent configuration it started with.

### Requirements

- DeepSeek Harness 0.1.1-rc.1 or a compatible newer release
- Node.js 22.19 or newer
- At least one model available in DSH **Settings > Models**

### Installation

Install the plugin in the DSH Web profile:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

Restart DSH Web after installation and refresh the browser. The plugin provisions and maintains its Agent preset automatically when the Host starts. It also provisions the legacy `orchestrator` preset ID so existing sessions created with that ID can resume while hiding official-name compatibility entries from Web selection lists. Exact official pre-marker copies are adopted safely; customized user-managed presets are never overwritten and remain visible when given a distinct name.

Existing settings with more than 3 Agents are preserved during an upgrade. The first 3 remain active, the settings page continues to show the complete roster, and the next save requires reducing it to 3 or fewer.

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

During a non-trivial session, the primary Agent establishes acceptance criteria and assigns development scopes before editing. It treats the configured roster as execution capacity, maps every meaningful separable scope to the best-fit specialist, and starts all independent matches together up to the three-Agent limit. A suitable specialist is not kept idle while the primary performs development, but the primary does not invent work merely to use every Agent. A running specialist owns its assigned scope; the primary may coordinate other clearly disjoint scopes but waits instead of implementing the same outcome. After specialists return, the primary reviews integration boundaries and runs the final acceptance checks.

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
pnpm release:check v0.7.0
~~~

Pushing a matching `vX.Y.Z` tag triggers verification and a GitHub Release with generated notes. npm publishing is not automatic.

Install a local checkout into a DSH source profile:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
~~~

## 中文

### 项目介绍

DSH Multi-model Orchestrator 为 DeepSeek Harness Web 设置页增加了 Agent 编排功能。你可以创建最多 3 个专业 Agent，为每个 Agent 选择 DSH 中已有的模型，并设置清晰的职责。

Session 使用 **Multi-model orchestrator** 预设后，每个已配置的 Agent 都会成为独立的子 Agent 工具，供主 Agent 按任务需要进行委派。

主 Agent 的定位是产品负责人和工程项目经理，而不是默认开发者。面对非简单工作，它先明确目标与验收标准，拆分互不重叠的范围，并在实施开始前委派开发、调查、测试和审查。每个 specialist 在返回前独占其委派范围；主 Agent 只协调不重叠工作、等待依赖、集成返回结果并执行最终验收。真正的一步小改仍可直接完成。

### 功能特性

- 创建和删除最多 3 个专业 Agent。
- 直接选择 DSH 中已有的模型。
- 为每个 Agent 设置固定 ID 和开发职责。
- 从对应模型实际提供的等级中选择可选推理等级。
- 为每个 Agent 设置可选的最大输出 Token。
- 由主 Agent 负责需求、计划、分配、集成和最终验收。
- specialist 独占已委派的开发范围，避免主 Agent 重复实现。
- 将有效范围分配给最匹配的可用 specialist，同时启动所有独立匹配项、等待依赖并复用可继续子 Agent，且不为占满容量人为制造任务。
- 运行中的 Session 保持启动时的 Agent 配置。

### 环境要求

- DeepSeek Harness 0.1.1-rc.1 或兼容的新版本
- Node.js 22.19 或更高版本
- DSH **设置 > 模型** 中至少有一个可用模型

### 安装

将插件安装到 DSH Web profile：

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

安装完成后重启 DSH Web，并刷新浏览器。Host 启动时，插件会自动预置并维护 Agent 预设，同时创建旧版 `orchestrator` 兼容 ID，使使用该 ID 的已有 Session 可以恢复，并从 Web 选择列表中隐藏使用官方显示名的兼容项。内容完全匹配官方旧版的无 marker preset 会被安全收编；经过自定义的用户 preset 不会被覆盖，改用不同名称时仍保持可见。

升级时，已有的超过 3 个 Agent 的配置会被完整保留。运行时先启用前 3 个，设置页继续显示完整列表，并要求在下次保存前缩减到 3 个以内。

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

在非简单 Session 中，主 Agent 会先确定验收标准并分配开发范围，再进入实施。它把已配置的 Agent 视为执行容量，将每个有效且可独立交付的范围分配给最匹配的 specialist，并在最多 3 个 Agent 的限制内同时启动所有独立匹配项。存在合适 specialist 时，主 Agent 不自行承担开发；但不会为了占满 Agent 人为制造任务。运行中的 specialist 独占其任务范围；主 Agent 可以协调其他明确不重叠的范围，但必须等待而不能并行实现相同目标。specialist 返回后，主 Agent 负责检查集成边界并执行最终验收。

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
pnpm release:check v0.7.0
~~~

推送匹配的 `vX.Y.Z` tag 会触发验证并创建带自动生成说明的 GitHub Release。npm 发布不会自动执行。

将本地仓库安装到 DSH 源码 profile：

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
~~~

## License

MIT
