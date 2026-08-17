import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, apply, inject, name, roleGuidance } from '../index.js'

const agents = [
  { id: 'architect', provider: 'alpha', model: 'model-a', description: 'Own architecture.' },
  { id: 'reviewer', provider: 'beta', model: 'model-b', description: 'Review independently.', maxTokens: 4096 },
]

test('exports the standard Cordis plugin contract and schema', () => {
  assert.equal(name, 'multi-model-orchestrator')
  assert.deepEqual(inject, ['systemPrompt'])
  const parsed = Config({ agents })
  assert.equal(parsed.transport, 'spawn')
  assert.equal(parsed.backgroundMode, 'continuable')
  assert.equal(parsed.maxDepth, 1)
})

test('publishes role guidance and mounts one tool plugin per agent', async () => {
  const mounted = []
  const sections = []
  const effects = []
  const ctx = {
    effect(factory, label) {
      const dispose = factory()
      effects.push({ dispose, label })
    },
    systemPrompt: {
      section(section) {
        sections.push(section)
        return () => sections.splice(sections.indexOf(section), 1)
      },
    },
    plugin(plugin, config) {
      mounted.push({ plugin, config })
      return { await: () => Promise.resolve() }
    },
  }

  await apply(ctx, { agents, transport: 'spawn', backgroundMode: 'continuable', maxDepth: 2 })

  assert.equal(mounted.length, 2)
  assert.equal(mounted[0].plugin.name, 'tool-subagent')
  assert.deepEqual(mounted.map(entry => entry.config.toolName), ['subagent_architect', 'subagent_reviewer'])
  assert.deepEqual(mounted[1].config.agentOptions, { provider: 'beta', model: 'model-b', maxTokens: 4096 })
  assert.equal(mounted[0].config.provider, 'spawn')
  assert.equal(mounted[0].config.backgroundMode, 'continuable')
  assert.equal(mounted[0].config.maxDepth, 2)
  assert.match(sections[0].text, /subagent_architect: Own architecture/)
  assert.equal(effects[0].label, 'multi-model-orchestrator.roles')
  effects[0].dispose()
  assert.equal(sections.length, 0)
})

test('rejects duplicate ids before mounting child plugins', async () => {
  let mounted = false
  const ctx = {
    effect() {}, systemPrompt: { section() {} },
    plugin() { mounted = true; return { await: () => Promise.resolve() } },
  }
  await assert.rejects(apply(ctx, { agents: [agents[0], agents[0]] }), /Duplicate agent id/)
  assert.equal(mounted, false)
})

test('renders stable model-visible role guidance', () => {
  const text = roleGuidance(agents)
  assert.match(text, /Configured specialists:/)
  assert.match(text, /subagent_reviewer/)
  assert.match(text, /Verify child results/)
})
