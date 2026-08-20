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
  assert.match(ctx.mounted[0].config.persona, /You are a development specialist/)
  assert.match(ctx.mounted[0].config.persona, /Own the assigned scope exclusively until you settle/)
  assert.match(ctx.mounted[0].config.persona, /run checks that cover your changes/)
  assert.match(ctx.mounted[0].config.persona, /report changed files, results, risks, and blockers to the primary Agent/)
  assert.match(ctx.mounted[0].config.persona, /never claim completion when a required check fails/)
  assert.ok(ctx.mounted[0].config.persona.indexOf('Own architecture.') < ctx.mounted[0].config.persona.indexOf('You are a development specialist'))
  assert.doesNotMatch(ctx.mounted[0].config.persona, /file ownership|Do not delegate/u)
  assert.equal(ctx.mounted[0].config.agentOptions.reasoningEffort, undefined)
  assert.match(ctx.sections[0].text, /subagent_architect: Own architecture/)
  assert.equal(ctx.sections[0].order, 116.6)
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

test('role guidance uses available capacity without duplicating or inventing work', () => {
  const text = roleGuidance(agents)
  assert.match(text, /Available specialists:/)
  assert.match(text, /subagent_reviewer: Review independently/)
  assert.match(text, /You have 2 configured development specialists/)
  assert.match(text, /Treat them as available execution capacity/)
  assert.match(text, /product\/project manager/)
  assert.match(text, /Own the outcome, acceptance criteria, decomposition, assignment, integration, and final acceptance/)
  assert.match(text, /Specialists own development/)
  assert.match(text, /clarify outcomes and acceptance criteria before implementation/)
  assert.match(text, /Map every meaningful separable scope to the best-fit available specialist/)
  assert.match(text, /different specialist for each concurrently executable scope/)
  assert.match(text, /Dispatch all independent matched scopes together, up to the available specialist count/)
  assert.match(text, /Do not keep a suitable specialist idle while you perform development/)
  assert.match(text, /only when no meaningful matching scope exists or its work depends on unfinished results/)
  assert.match(text, /Never invent work merely to use every specialist/)
  assert.match(text, /exclusively owns its assigned scope and acceptance target until it formally returns/)
  assert.match(text, /Never implement or run equivalent tests for a target a child owns/)
  assert.match(text, /Continue only clearly non-overlapping management work/)
  assert.match(text, /Before every analysis, edit, or test step, re-check whether any child owning a related scope is still running/)
  assert.match(text, /hard phase barrier/)
  assert.match(text, /After any child returns, do not advance immediately if another child is still running/)
  assert.match(text, /status is missing, partial, or ambiguous/)
  assert.match(text, /do not begin integration or final acceptance until every relevant child has formally returned/)
  assert.match(text, /run_in_background: false when the next step depends on that child/)
  assert.match(text, /Wait for prerequisites before starting dependent work/)
  assert.match(text, /Reuse the same continuable child for follow-up on the same task/)
  assert.match(text, /run final acceptance checks/)
  assert.match(text, /Handle a trivial one-step change entirely yourself/)
  assert.doesNotMatch(text, /file ownership|At each step boundary|cancel or mark as non-blocking|fixed delegation ratio/u)
  assert.match(roleGuidance([]), /No orchestrator specialists are configured/)
})
