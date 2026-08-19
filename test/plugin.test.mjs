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
  assert.match(ctx.mounted[0].config.persona, /Work on the assigned task/)
  assert.match(ctx.mounted[0].config.persona, /run checks appropriate to the change/)
  assert.match(ctx.mounted[0].config.persona, /report changed files, results, risks, and blockers/)
  assert.ok(ctx.mounted[0].config.persona.indexOf('Own architecture.') < ctx.mounted[0].config.persona.indexOf('Work on the assigned task'))
  assert.doesNotMatch(ctx.mounted[0].config.persona, /file ownership|acceptance checks|Do not delegate/u)
  assert.equal(ctx.mounted[0].config.agentOptions.reasoningEffort, undefined)
  assert.match(ctx.sections[0].text, /subagent_architect: Own architecture/)
  assert.equal(ctx.effects[0].label, 'multi-model-orchestrator.roles')
  ctx.effects[0].dispose()
  assert.equal(ctx.sections.length, 0)
})

test('binds reasoning effort at request time when apply has no current Agent', async () => {
  const ctx = agentContext(agents)
  await apply(ctx)
  assert.equal(ctx.listeners.length, 1)
  assert.equal(ctx.listeners[0].event, 'agent/request')
  const requestAgent = {
    session: {
      header: { seedLength: 1 },
      events: [
        { type: 'subagent/descriptor', data: { mode: 'continuable', persona: specialistPersona(agents[1]) } },
        { type: 'subagent/descriptor', data: { mode: 'continuable', persona: specialistPersona(agents[0]) } },
      ],
    },
  }
  const downstream = { provider: 'alpha', model: 'model-a', reasoningEffort: 'low', temperature: 0.2 }
  let calls = 0
  const request = await ctx.listeners[0].listener({ agent: requestAgent }, async () => {
    calls += 1
    return downstream
  })
  assert.equal(calls, 1)
  assert.notEqual(request, downstream)
  assert.deepEqual(request, { provider: 'alpha', model: 'model-a', reasoningEffort: 'high', temperature: 0.2 })
  assert.deepEqual(downstream, { provider: 'alpha', model: 'model-a', reasoningEffort: 'low', temperature: 0.2 })
})

test('leaves non-matching sessions unchanged and ignores inherited descriptors', async () => {
  const ctx = agentContext(agents)
  await apply(ctx)
  const downstream = { provider: 'beta', model: 'model-b' }
  const sessions = [
    { header: {}, events: [] },
    { header: { seedLength: 1 }, events: [
      { type: 'subagent/descriptor', data: { mode: 'continuable', persona: specialistPersona(agents[0]) } },
      { type: 'user/message', data: {} },
    ] },
    { header: {}, events: [
      { type: 'subagent/descriptor', data: { mode: 'continuable', persona: agents[0].description } },
    ] },
    { header: {}, events: [
      { type: 'subagent/descriptor', data: { mode: 'one-shot', persona: specialistPersona(agents[0]) } },
    ] },
    { header: {}, events: [
      { type: 'subagent/descriptor', data: { mode: 'continuable', persona: 'Your orchestrator Agent ID is "unknown".' } },
    ] },
    { header: {}, events: [
      { type: 'subagent/descriptor', data: { mode: 'continuable', persona: specialistPersona(agents[1]) } },
    ] },
  ]
  for (const session of sessions) {
    let calls = 0
    const request = await ctx.listeners[0].listener({ agent: { session } }, async () => {
      calls += 1
      return downstream
    })
    assert.equal(calls, 1)
    assert.equal(request, downstream)
  }
})

test('does not register request middleware when no specialist selects an effort', async () => {
  const ctx = agentContext([agents[1]])
  await apply(ctx)
  assert.equal(ctx.mounted.length, 1)
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
  assert.match(text, /Available specialists:/)
  assert.match(text, /subagent_reviewer: Review independently/)
  assert.match(text, /Delegate when a specialist can move the work forward/)
  assert.match(text, /Start independent tasks together/)
  assert.match(text, /wait for prerequisites before starting dependent work/)
  assert.match(text, /continue the existing child instead of starting a duplicate/)
  assert.match(text, /final checks appropriate to the risk/)
  assert.doesNotMatch(text, /file ownership|acceptance checks|At each step boundary|cancel or mark as non-blocking/u)
  assert.match(roleGuidance([]), /No orchestrator specialists are configured/)
})
