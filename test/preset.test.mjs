import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import Include, { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import OrchestratorPresetInclude from '../preset-loader.js'

const yaml = createRequire(import.meta.resolve('@deepseek-ai/cordis-plugin-include'))('js-yaml')

for (const directory of ['preset', 'preset-legacy']) {
  test(directory + ' retains standard context and tools alongside orchestration', async () => {
    const source = await readFile(new URL('../' + directory + '/agent.cordis.yml', import.meta.url), 'utf8')
    const entries = yaml.load(source, { schema: entryListSchema })
    for (const plugin of ['dsh-time-context', 'dsh-agent-instructions', 'dsh-skill-filesystem', 'dsh-tool-skill', 'dsh-tool-present']) {
      assert.ok(entries.some(entry => entry.name === '@deepseek-ai/' + plugin && entry.disabled !== true), 'missing ' + plugin)
    }
    assert.match(source, /name: '@deepseek-ai\/dsh-tool-schedule'\r?\n\s+disabled: true/u)
    assert.match(source, /name: '@deepseek-ai\/dsh-tool-subagent-control\/list-agents'\r?\n\s+disabled: true/u)
    assert.match(source, /powered by the \{\{model\}\} model/u)
    const persona = entries.find(entry => entry.id === 'persona').config
    assert.doesNotMatch(persona.prefix, /\{\{cwd\}\}/u)
    const suffix = new Function('ctx', 'return ' + persona.suffix.__jsExpr)
    assert.equal(suffix({ get: () => ({}) }), '')
    assert.match(suffix({ get: () => undefined }), /Your working directory is \{\{cwd\}\}/u)
    assert.match(source, /user approves your plan through exit_plan_mode or switches the session mode/u)
    assert.match(source, /name: 'dsh-multi-model-orchestrator\/agent'/u)
    assert.match(source, /Dispatch independent tasks concurrently/u)
    assert.match(source, /Do not begin integration or final acceptance until every relevant child has done so/u)
    assert.match(source, /name: '@deepseek-ai\/dsh-agent-tool-presentation'[\s\S]*?mode: ptc/u)
  })
}

test('optional schedule loading preserves old runtimes and surfaces broken dependencies', async t => {
  t.mock.method(Include.prototype, 'read', async () => true)
  const schedule = { id: 'tool-schedule', name: '@deepseek-ai/dsh-tool-schedule', disabled: true }
  const state = { data: [schedule], import: async () => ({}) }
  assert.equal(await OrchestratorPresetInclude.prototype.read.call(state), true)
  assert.equal(schedule.disabled, false)
  schedule.disabled = true
  state.import = async () => { throw Object.assign(new Error("Cannot find package '@deepseek-ai/dsh-tool-schedule'"), { code: 'ERR_MODULE_NOT_FOUND' }) }
  await OrchestratorPresetInclude.prototype.read.call(state)
  assert.equal(schedule.disabled, true)
  state.import = async () => { throw Object.assign(new Error("Cannot find package 'broken-dependency' imported from /node_modules/@deepseek-ai/dsh-tool-schedule/lib/index.js"), { code: 'ERR_MODULE_NOT_FOUND' }) }
  await assert.rejects(() => OrchestratorPresetInclude.prototype.read.call(state), /broken-dependency/u)
})
test('optional list-agents loading preserves old runtimes and disables on consolidated runtimes', async t => {
  t.mock.method(Include.prototype, 'read', async () => true)
  const listAgents = { id: 'tool-subagent-list-agents', name: '@deepseek-ai/dsh-tool-subagent-control/list-agents', disabled: true }
  const delegation = { id: 'delegation', group: true, config: [listAgents] }
  const state = { data: [delegation], import: async () => ({}) }
  assert.equal(await OrchestratorPresetInclude.prototype.read.call(state), true)
  assert.equal(listAgents.disabled, false)
  listAgents.disabled = true
  state.import = async () => { throw Object.assign(new Error("Package subpath './list-agents' is not defined"), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }) }
  await OrchestratorPresetInclude.prototype.read.call(state)
  assert.equal(listAgents.disabled, true)
  listAgents.disabled = false
  await OrchestratorPresetInclude.prototype.read.call(state)
  assert.equal(listAgents.disabled, true)
  state.import = async () => { throw Object.assign(new Error("Cannot find package '@deepseek-ai/dsh-tool-subagent-control'"), { code: 'ERR_MODULE_NOT_FOUND' }) }
  await OrchestratorPresetInclude.prototype.read.call(state)
  assert.equal(listAgents.disabled, true)
})
