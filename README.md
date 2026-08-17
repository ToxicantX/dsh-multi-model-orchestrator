# DSH Multi-model Orchestrator

A DeepSeek Harness bundle for configuring any number of specialist subagents from models that already exist in DSH.

## What it does

- Adds **Settings > Agent orchestration** to the DSH Web GUI.
- Reads selectable Provider/Model routes from DSH's `llm.models` catalog.
- Stores only Agent ID, Provider ID, Model ID, role description, and optional maximum output tokens.
- Mounts one lifecycle-owned `@deepseek-ai/dsh-tool-subagent` plugin for each configured Agent.
- Keeps API keys, Base URLs, protocols, and model discovery in DSH **Settings > Models**.

## Requirements

- DeepSeek Harness 0.1.0-rc.5 or a compatible newer release
- Node.js 22.19 or newer
- At least one model configured in DSH **Settings > Models**

## Install from GitHub

Install and activate the bundle in the Web profile:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
~~~

Install the fixed Agent preset once:

~~~powershell
dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

Restart DSH Web after first installation, refresh the browser, then:

1. Open **Settings > Agent orchestration**.
2. Add any number of Agents.
3. Select an existing DSH model for each Agent.
4. Save and create a new session with **Multi-model orchestrator**.

When running DSH from its source checkout, replace `dsh` with `pnpm dsh` in both commands.

## Updating Agents

Agent configuration is saved in DSH's `multi-model-orchestrator` Settings namespace. Saving touches the fixed preset composition stamp so DSH creates a new preset generation for later sessions. Existing sessions retain the Agent roster and models they started with.

You do not need to rerun the installer after adding, removing, or changing Agents.

## Architecture

The package has three runtime faces:

- `host.js` is the bundle row. It owns the Settings schema and publishes the current Agent configuration as a host service.
- `agent.js` is mounted by the fixed Agent preset. It snapshots the configured roster and mounts the corresponding subagent tools.
- `lib/client.js` is the DSH client-plugin bundle. It contributes the settings section, reads the model catalog through `llm.models`, and reads/writes only `{ agents }` through the plugin-owned same-origin settings endpoint.

DSH currently has no bundle manifest field for contributing an Agent preset, so the package installer copies one fixed thin preset into `$DSH_HOME/.agent-presets/multi-model-orchestrator`. This is a one-time installation step, not Agent configuration generation.

## Local development

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
pnpm bundle
pnpm test
~~~

Install the checkout into a local DSH source profile:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
pnpm dsh plugin --profile web exec dsh-orchestrator-install --force
~~~

## Security boundary

This package never asks for, stores, logs, or sends API keys and Base URLs. Provider credentials and endpoints remain owned by DSH's model and credential services. The settings client saves only route references and Agent metadata.

Pin a Git commit when a deployment requires reproducible GitHub installation.

## 中文说明

安装后只需在 DSH 的 **设置 > Agent 编排** 中添加 Agent，并从 DSH 已配置好的模型中选择。插件不再使用 Agent JSON，也不需要在修改 Agent 后重新生成 preset。

API Key、Base URL、接口协议和模型发现继续由 DSH 的 **设置 > 模型** 管理。本插件只保存 Provider/Model 引用、Agent ID、职责描述和可选 Token 上限。保存后新建 Session 即可使用新的 Agent 配置，已有 Session 不受影响。

## License

MIT
