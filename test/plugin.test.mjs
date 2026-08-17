import assert from 'node:assert/strict'
import test from 'node:test'
import agentPlugin, { Config, apply, inject, name, roleGuidance } from '../agent.js'

const agents = [
  { id: 'architect', provider: 'alpha', model: 'model-a', description: 'Own architecture.' },
  { id: 'reviewer', provider: 'beta', model: 'model-b', description: 'Review independently.', maxTokens: 4096 },
]

function agentContext(snapshot = agents) {
  const mounted = []
  const sections = []
  const effects = []
  return {
    mounted, sections, effects,
    inject,
    multiModelOrchestrator: { currentAgents: () => snapshot.map(agent => ({ ...agent })) },
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
}

test('exports the fixed agent plugin contract and empty Config schema', () => {
  assert.equal(name, 'multi-model-orchestrator-agent')
  assert.deepEqual(inject, ['systemPrompt', 'multiModelOrchestrator'])
  assert.deepEqual(Config({}), {})
  assert.equal(agentPlugin, apply)
  assert.deepEqual(agentPlugin.inject, inject)
  assert.equal(agentPlugin.Config, Config)
})

test('reads one service snapshot and mounts one ToolSubagent per configured agent', async () => {
  const ctx = agentContext()
  await apply(ctx)
  assert.equal(ctx.mounted.length, 2)
  assert.equal(ctx.mounted[0].plugin.name, 'tool-subagent')
  assert.deepEqual(ctx.mounted.map(entry => entry.config.toolName), ['subagent_architect', 'subagent_reviewer'])
  assert.deepEqual(ctx.mounted[1].config.agentOptions, { provider: 'beta', model: 'model-b', maxTokens: 4096 })
  assert.equal(ctx.mounted[0].config.provider, 'spawn')
  assert.equal(ctx.mounted[0].config.backgroundMode, 'continuable')
  assert.equal(ctx.mounted[0].config.maxDepth, 1)
  assert.match(ctx.sections[0].text, /subagent_architect: Own architecture/)
  assert.equal(ctx.effects[0].label, 'multi-model-orchestrator.roles')
  ctx.effects[0].dispose()
  assert.equal(ctx.sections.length, 0)
})

test('empty service snapshot mounts no children and explains configuration state', async () => {
  const ctx = agentContext([])
  await apply(ctx)
  assert.equal(ctx.mounted.length, 0)
  assert.match(ctx.sections[0].text, /No orchestrator specialists are configured/)
  assert.match(ctx.sections[0].text, /Settings > Orchestrator/)
})

test('role guidance lists configured roles and delegation policy', () => {
  const text = roleGuidance(agents)
  assert.match(text, /Configured specialists:/)
  assert.match(text, /subagent_reviewer: Review independently/)
  assert.match(text, /Delegate independent work concurrently/)
  assert.match(roleGuidance([]), /No orchestrator specialists are configured/)
})
