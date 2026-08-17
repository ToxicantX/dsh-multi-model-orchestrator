import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { normalizeAgents } from '../src/config.js'
import { install, parseArgs, renderTemplate, resolveAgents } from '../src/install.mjs'

const agent = (id, overrides = {}) => ({
  id,
  provider: 'provider-' + id,
  model: 'model-' + id,
  description: 'Own the ' + id + ' specialist role.',
  ...overrides,
})

const template = '__ORCHESTRATOR_PLUGIN_ROW__\n'

test('parses config and preserves legacy route options', () => {
  assert.deepEqual(parseArgs(['--config', 'agents.json', '--force']), {
    presetId: 'multi-model-orchestrator', force: true, config: 'agents.json',
  })
  assert.deepEqual(parseArgs(['--agent-a-provider', 'alpha', '--agent-a-model', 'model-a', '--agent-b-provider', 'beta', '--agent-b-model', 'model-b']), {
    presetId: 'multi-model-orchestrator', force: false, agentAProvider: 'alpha', agentAModel: 'model-a', agentBProvider: 'beta', agentBModel: 'model-b',
  })
})

test('normalizes one or many agents and supplies a default persona', () => {
  const one = normalizeAgents([{ id: 'solo', provider: 'route', model: 'model' }])
  assert.equal(one.length, 1)
  assert.match(one[0].description, /solo specialist/)
  assert.equal(normalizeAgents(Array.from({ length: 12 }, (_, index) => agent('worker-' + index))).length, 12)
})

test('rejects empty, malformed, duplicate, and incomplete agents', () => {
  assert.throws(() => normalizeAgents([]), /non-empty array/)
  assert.throws(() => normalizeAgents([agent('Bad ID')]), /Invalid agent id/)
  assert.throws(() => normalizeAgents([agent('same'), agent('same')]), /Duplicate agent id/)
  assert.throws(() => normalizeAgents([{ id: 'missing', provider: 'route' }]), /model/)
  assert.throws(() => normalizeAgents([agent('newline', { provider: 'route\ninjected' })]), /Invalid newline/)
  assert.throws(() => normalizeAgents([agent('tokens', { maxTokens: 0 })]), /positive safe integer/)
})

test('renders one plugin row containing all configured agents', () => {
  const agents = [
    agent('architect', { provider: 'vendor:custom', model: 'model/a' }),
    agent('researcher'),
    agent('reviewer', { description: 'Review: edge cases # without YAML injection.' }),
  ]
  const output = renderTemplate(template, agents)
  assert.equal((output.match(/name: 'dsh-multi-model-orchestrator'/gu) ?? []).length, 1)
  assert.equal((output.match(/^          - id:/gmu) ?? []).length, 3)
  assert.match(output, /provider: "vendor:custom"/)
  assert.match(output, /model: "model\/a"/)
  assert.match(output, /description: "Review: edge cases # without YAML injection\."/)
  assert.doesNotMatch(output, /__(?:ORCHESTRATOR|SUBAGENT)_/u)
})

test('resolves legacy A/B options and rejects mixed configuration modes', async () => {
  const legacy = await resolveAgents({ agentAProvider: 'alpha', agentAModel: 'one', agentBProvider: 'beta', agentBModel: 'two' })
  assert.deepEqual(legacy.map(entry => entry.id), ['a', 'b'])
  await assert.rejects(resolveAgents({ config: 'agents.json', agentAProvider: 'alpha' }), /cannot be combined/)
  await assert.rejects(resolveAgents({ agentAProvider: 'alpha' }), /all four legacy/)
})

test('installs a plugin-backed three-agent preset without secrets or local paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-'))
  try {
    const config = join(root, 'agents.json')
    const target = join(root, 'preset')
    await writeFile(config, JSON.stringify({ agents: [agent('architect'), agent('researcher'), agent('reviewer')] }))
    const result = await install({ config, target })
    const output = await readFile(join(target, 'agent.cordis.yml'), 'utf8')
    assert.equal(result.agents.length, 3)
    assert.equal((output.match(/name: 'dsh-multi-model-orchestrator'/gu) ?? []).length, 1)
    assert.equal((output.match(/^          - id:/gmu) ?? []).length, 3)
    assert.match(output, /id: "reviewer"/)
    assert.doesNotMatch(output, /toolName: subagent_|__(?:ORCHESTRATOR|SUBAGENT)_|api.?key|D:\\DevTools|gpt-5\.6|grok-4\.6|Luna MAX/iu)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
