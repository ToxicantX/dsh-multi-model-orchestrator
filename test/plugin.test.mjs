import assert from 'node:assert/strict'
import test from 'node:test'
import agentPlugin, { Config, apply, inject, name, roleGuidance, specialistPersona } from '../agent.js'

const agents = [
  { id: 'architect', provider: 'alpha', model: 'model-a', description: 'Own architecture.', reasoningEffort: 'high' },
  { id: 'reviewer', provider: 'beta', model: 'model-b', description: 'Review independently.', maxTokens: 4096 },
]

function agentContext(snapshot = agents, currentAgent) {
  const mounted = []
  const sections = []
  const effects = []
  const listeners = []
  return {
    mounted, sections, effects, listeners,
    inject,
    agent: currentAgent,
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
    on(event, listener) {
      listeners.push({ event, listener })
      return () => listeners.splice(listeners.findIndex(entry => entry.listener === listener), 1)
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
  assert.equal(ctx.mounted[0].config.persona, specialistPersona(agents[0]))
  assert.match(ctx.mounted[0].config.persona, /^Your orchestrator Agent ID is "architect"\./u)
  assert.match(ctx.mounted[0].config.persona, /implementation specialist/)
  assert.match(ctx.mounted[0].config.persona, /Before reporting completion, inspect your diff and run the focused tests, type checks, or build checks/)
  assert.match(ctx.mounted[0].config.persona, /report the failure instead of claiming completion/)
  assert.match(ctx.mounted[0].config.persona, /Leave overall analysis, architecture decisions, cross-task integration, and final independent verification to the primary Agent/)
  assert.ok(ctx.mounted[0].config.persona.indexOf('Own architecture.') < ctx.mounted[0].config.persona.indexOf('Treat the development scope above only as a specialization'))
  assert.match(ctx.mounted[0].config.persona, /primary Agent\.$/u)
  assert.equal(ctx.mounted[0].config.agentOptions.reasoningEffort, undefined)
  assert.match(ctx.sections[0].text, /subagent_architect: Own architecture/)
  assert.equal(ctx.effects[0].label, 'multi-model-orchestrator.roles')
  ctx.effects[0].dispose()
  assert.equal(ctx.sections.length, 0)
})

test('binds reasoning effort to a continuable child by its persisted Agent ID', async () => {
  const persona = specialistPersona(agents[0])
  const currentAgent = {
    session: {
      header: { seedLength: 1 },
      events: [
        { type: 'user/message', data: {} },
        { type: 'subagent/descriptor', data: { mode: 'continuable', persona } },
      ],
    },
  }
  const ctx = agentContext(agents, currentAgent)
  await apply(ctx)
  assert.equal(ctx.listeners.length, 1)
  assert.equal(ctx.listeners[0].event, 'agent/request')
  let delegated = false
  const request = await ctx.listeners[0].listener({}, async () => {
    delegated = true
    return { provider: 'alpha', model: 'model-a', reasoningEffort: 'low', temperature: 0.2 }
  })
  assert.equal(delegated, true)
  assert.deepEqual(request, { provider: 'alpha', model: 'model-a', reasoningEffort: 'high', temperature: 0.2 })
})

test('does not infer specialist identity from the role description alone', async () => {
  const currentAgent = { session: { header: {}, events: [
    { type: 'subagent/descriptor', data: { mode: 'continuable', persona: agents[0].description } },
  ] } }
  const ctx = agentContext(agents, currentAgent)
  await apply(ctx)
  assert.equal(ctx.listeners.length, 0)
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
  assert.match(text, /Configured implementation specialists:/)
  assert.match(text, /subagent_reviewer: Review independently/)
  assert.match(text, /Own the primary analysis/)
  assert.match(text, /Delegate scoped development and adjustment work concurrently/)
  assert.match(text, /At each step boundary, process specialist completion notices/)
  assert.match(text, /Require each specialist to report its diff and executed checks/)
  assert.match(text, /independently run the final verification yourself/)
  assert.match(text, /Do not delegate overall architecture decisions or final acceptance/)
  assert.match(text, /cancel or mark as non-blocking/)
  assert.match(roleGuidance([]), /No orchestrator specialists are configured/)
})
