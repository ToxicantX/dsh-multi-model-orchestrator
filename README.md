# DSH Multi-model Orchestrator

A provider-neutral [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) preset that gives one primary coding agent any number of independently routed subagents. Provider credentials stay in DSH's write-only credential store; generated presets contain only provider/model references and role instructions.

## Requirements

- DeepSeek Harness 0.1.0-rc.5 or newer
- Node.js 22.19 or newer
- One model route per distinct endpoint/account, configured in **Settings > Models**

Routes can use different vendors or separate accounts and endpoints from the same vendor. Multiple agents may also share one route while using the same or different model IDs. API keys are never passed to this installer or written into the preset.

## Configure agents

Copy `orchestrator.example.json` and edit its `agents` array. Add or remove as many entries as needed:

~~~json
{
  "agents": [
    {
      "id": "architect",
      "provider": "provider-a",
      "model": "model-a",
      "description": "Own architecture, deep implementation, and complex debugging."
    },
    {
      "id": "reviewer",
      "provider": "provider-b",
      "model": "model-b",
      "description": "Perform adversarial review, test edge cases, and report concrete risks."
    }
  ]
}
~~~

Each entry generates a tool named `subagent_<id>`:

- `id`: unique lowercase identifier beginning with a letter; letters, numbers, `_` and `-` are accepted.
- `provider`: route ID created in **Settings > Models**.
- `model`: model ID registered under that route.
- `description`: optional single-line role instruction used as the child's persona and shown to the primary orchestrator. It is not a task label.

At least one agent is required. There is no fixed agent-count limit in the installer; practical limits come from model tool-catalog size and available compute.

## Install

1. In DSH, open **Settings > Models** and create every route referenced by the JSON configuration. Enter each route's API key, Base URL, protocol, and model IDs there.
2. Clone this repository and create your configuration:

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
Copy-Item orchestrator.example.json orchestrator.json
# Edit orchestrator.json, then install:
node src/install.mjs --config orchestrator.json
~~~

3. Refresh DSH and select **Multi-model orchestrator** as the Agent preset.

Use `--force` to replace an existing installation. `DSH_HOME` is respected; otherwise the installer uses `~/.dsh`.

## Legacy two-agent command

The original v0.1 command remains supported:

~~~powershell
node src/install.mjs `
  --agent-a-provider provider-a --agent-a-model model-a `
  --agent-b-provider provider-b --agent-b-model model-b
~~~

New installations should use `--config` because it supports arbitrary counts, stable role names, and custom instructions.

## Updating agents and routes

DSH captures the generated subagent list and each Provider/Model reference when the preset is mounted:

- API keys and Base URLs remain editable live in **Settings > Models**.
- To add/remove an agent or change its ID, Provider, model, or description, update the JSON file, rerun with `--force`, and refresh DSH.

## Security

- Never put API keys in the JSON config, `agent.cordis.yml`, command arguments, or Git.
- DSH Settings stores credentials separately and returns only redacted configured-state metadata to the browser.
- Provider IDs, model IDs, and role descriptions are the only agent data stored by this preset.
- Review `~/.dsh/.credentials.yaml` permissions or use environment-backed credentials where required by your deployment.

## Development

~~~shell
npm test
~~~

Tests cover one, three, and twelve agents; legacy compatibility; duplicate and malformed IDs; missing fields; route quoting; configuration-mode conflicts; secret/path scanning; and real preset installation.

## 中文说明

这是一个可自定义子 Agent 数量的 DSH 主控预设。编辑 `orchestrator.json` 中的 `agents` 数组即可增加或删除 Agent；每项分别配置 ID、Provider、模型和职责说明，安装后会生成 `subagent_<id>` 工具。

每个 Provider 的 API Key、Base URL、协议和模型目录仍在 **设置 → 模型** 中安全管理。安装器只写入 Provider ID、Model ID 和职责说明，不读取或保存密钥。修改 Agent 数量或路由绑定后，使用 `--force` 重新安装并刷新 DSH。

## License

MIT
