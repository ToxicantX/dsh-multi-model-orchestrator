# DSH Multi-model Orchestrator

A provider-neutral [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) preset that gives one primary coding agent two independently routed subagents. It keeps provider credentials in DSH's write-only credential store and commits only provider/model references.

## Requirements

- DeepSeek Harness 0.1.0-rc.5 or newer
- Node.js 22.19 or newer
- Two model routes configured in **Settings > Models**

Each route can use its own API key, Base URL, protocol, and model catalog. The routes may use different vendors or separate accounts/endpoints from the same vendor. API keys are never passed to this installer or written into the preset.

## Install

1. In DSH, open **Settings > Models** and add two provider routes. Enter each route's API key, Base URL, protocol, and model IDs there.
2. Clone and install:

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
node src/install.mjs `
  --agent-a-provider provider-a --agent-a-model model-a `
  --agent-b-provider provider-b --agent-b-model model-b
~~~

3. Refresh DSH and select **Multi-model orchestrator** as the Agent preset.

Use `--force` to update an existing installation. `DSH_HOME` is respected; otherwise the installer uses `~/.dsh`.

## Roles

- **Primary** owns planning, delegation, integration, and final verification. Its model remains selectable through the normal DSH model control.
- **Agent A** focuses on architecture, deep implementation, and debugging.
- **Agent B** focuses on independent implementation, research, tests, and adversarial review.

The role names are intentionally provider-neutral. Edit the installed persona text when a team needs different responsibilities.

## Updating routes

DSH currently captures subagent Provider/Model references when the preset is mounted. API keys and Base URLs remain editable live in **Settings > Models**. To change which Provider or model Agent A/B uses, rerun the installer with the new IDs and `--force`, then refresh DSH.

## Security

- Never put API keys in `agent.cordis.yml`, command arguments, or Git.
- DSH Settings stores credentials separately and returns only redacted configured-state metadata to the browser.
- Provider IDs and model IDs are not secrets and are the only route data stored by this preset.
- Review `~/.dsh/.credentials.yaml` permissions or use environment-backed credentials where required by your deployment.

## Development

~~~shell
npm test
~~~

Tests render and install the real preset, reject incomplete role mappings, and assert that output contains no API-key fields, machine-local paths, or original vendor-specific names.

## 中文说明

这是一个通用的 DSH 双子 Agent 主控预设。先在 **设置 > 模型** 中分别创建两个 Provider 路由，并为每个路由配置独立的 API Key、Base URL、协议和模型；安装器只写入 Provider ID 与 Model ID，不读取也不保存密钥。主控模型仍可在 DSH 原有模型选择器中配置。

DSH 当前会在挂载 preset 时固定子 Agent 的 Provider/Model 引用。Key 与 URL 可直接在设置页更新；如需切换 Agent A/B 所用的 Provider 或模型，请带新参数和 `--force` 重新运行安装器并刷新页面。

## License

MIT
