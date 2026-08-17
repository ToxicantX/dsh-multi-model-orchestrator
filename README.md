# DSH Multi-model Orchestrator

A provider-neutral Cordis agent plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It mounts any number of configured `@deepseek-ai/dsh-tool-subagent` child plugins inside one agent-scoped preset.

## Architecture

This package is an actual Cordis plugin:

- `index.js` exports `name`, `inject`, a Schemastery `Config`, and `apply(ctx, config)`.
- `apply` mounts one lifecycle-owned `dsh-tool-subagent` plugin per configured specialist.
- The plugin contributes model-visible role guidance through `ctx.systemPrompt.section()`.
- The agent preset contains one `dsh-multi-model-orchestrator` row. It does not duplicate subagent implementation rows.
- Provider API keys and Base URLs remain in DSH **Settings > Models** and never enter this package's config.

DSH currently has no bundle manifest field for contributing agent presets. This is therefore an **agent-plane plugin dependency plus an agent preset**, not a host-plane bundle. `dsh plugin add` may print that the package is a plain dependency; that is expected because the preset activates it per session.

## Requirements

- DeepSeek Harness 0.1.0-rc.5 or newer
- Node.js 22.19 or newer
- Provider routes configured in **Settings > Models**

## Quick install from GitHub

Create a local configuration file from the published example:

~~~powershell
$Config = Join-Path $HOME 'orchestrator.json'
Invoke-WebRequest 'https://raw.githubusercontent.com/ToxicantX/dsh-multi-model-orchestrator/main/orchestrator.example.json' -OutFile $Config
notepad $Config
~~~

Install the plugin dependency and generate the preset:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-multi-model-orchestrator
dsh plugin --profile web exec dsh-orchestrator-install --config $Config --force
~~~

The plain-dependency warning is expected: DSH activates this agent-plane plugin from the generated preset rather than as a host bundle. Refresh DSH and create a new session using **Multi-model orchestrator**.

When running DSH from its source checkout, replace each `dsh` command above with `pnpm dsh`.

## Configure agents

Copy `orchestrator.example.json` to `orchestrator.json` and edit the `agents` array:

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
      "description": "Perform adversarial review and test edge cases.",
      "maxTokens": 8192
    }
  ]
}
~~~

Each entry becomes `subagent_<id>`. IDs must be unique lowercase identifiers beginning with a letter. `provider` and `model` reference routes from DSH Settings. `description` is the child's persona and the role shown to the primary agent.

## Install

Clone the repository:

~~~powershell
git clone https://github.com/ToxicantX/dsh-multi-model-orchestrator.git
cd dsh-multi-model-orchestrator
pnpm install
Copy-Item orchestrator.example.json orchestrator.json
~~~

Install the plugin dependency into the Web profile. From a DSH source checkout:

~~~powershell
pnpm dsh plugin --profile web add -w D:/path/to/dsh-multi-model-orchestrator
~~~

With a globally installed `dsh` command:

~~~powershell
dsh plugin --profile web add -w ./dsh-multi-model-orchestrator
~~~

Generate the agent-scoped preset:

~~~powershell
node src/install.mjs --config orchestrator.json --force
~~~

Refresh DSH and select **Multi-model orchestrator** for a new session. Existing sessions keep the composition they started with.

## Plugin configuration

The Cordis schema also supports these preset-row fields:

~~~yaml
config:
  transport: spawn
  backgroundMode: continuable
  maxDepth: 1
  agents: []
~~~

The installer emits only `agents` and uses the schema defaults shown above. Advanced deployments may edit the installed preset row directly.

## Security

- Never put API keys in `orchestrator.json`, the preset, command arguments, or Git.
- DSH stores keys through its credential service and exposes only redacted state to the browser.
- This preset is executable agent-plane composition and carries user-level trust.
- Pin a Git commit when installing directly from GitHub.

## Development

~~~shell
pnpm install
pnpm test
pnpm pack
~~~

Tests cover the Cordis export contract, Schemastery defaults, dynamic child-plugin configs, prompt registration cleanup, invalid config, one/three/twelve agents, legacy CLI compatibility, and plugin-backed preset generation.

## 中文说明

本项目现在是标准 Cordis Agent 插件，不再只是展开 YAML 的模板生成器。插件导出 `Config` 与 `apply`，并在每个 session 的 agent scope 中创建和回收动态子 Agent 插件。preset 只保留一条插件挂载配置。

API Key、Base URL、协议和模型目录仍在 DSH 的 **设置 → 模型** 中管理。修改 Agent 数量或路由后，重新执行带 `--force` 的安装命令，并新建 session。

## License

MIT
