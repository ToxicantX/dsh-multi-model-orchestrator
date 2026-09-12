import assert from 'node:assert/strict'
import test from 'node:test'
import agentPlugin, { Config, apply, inject, name, roleGuidance, specialistPersona } from '../agent.js'

const agents = [
  { id: 'architect', provider: 'alpha', model: 'model-a', description: 'Own architecture.', persona: 'Design boundaries and tradeoffs before editing.', reasoningEffort: 'high' },
  { id: 'reviewer', provider: 'beta', model: 'model-b', description: 'Review independently.', maxTokens: 4096 },
]

function agentContext(snapshot = agents) {
  const mounted = []
  const sections = []
  const effects = []
  const sectionOrders = []
  return {
    mounted, sections, effects, sectionOrders,
    inject,
    multiModelOrchestrator: { currentAgents: () => snapshot.map(agent => ({ ...agent })) },
    effect(factory, label) {
      const dispose = factory()
      effects.push({ dispose, label })
    },
    systemPrompt: {
      getSectionOrder(name) {
        sectionOrders.push(name)
        return 600
      },
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
  assert.deepEqual(ctx.mounted[0].config.agentOptions, { provider: 'alpha', model: 'model-a', reasoningEffort: 'high' })
  assert.deepEqual(ctx.mounted[1].config.agentOptions, { provider: 'beta', model: 'model-b', maxTokens: 4096 })
  assert.equal(ctx.mounted[0].config.provider, 'spawn')
  assert.equal(ctx.mounted[0].config.backgroundMode, 'continuable')
  assert.equal(ctx.mounted[0].config.maxDepth, 1)
  assert.equal(ctx.mounted[0].config.persona, specialistPersona(agents[0]))
  assert.match(ctx.mounted[0].config.persona, /^Your orchestrator Agent ID is "architect"\./u)
  assert.match(ctx.mounted[0].config.persona, /Design boundaries and tradeoffs before editing/u)
  assert.doesNotMatch(ctx.mounted[0].config.persona, /Own architecture\.[\s\S]*Design boundaries/u)
  assert.match(ctx.mounted[0].config.persona, /You are a development specialist/)
  assert.match(ctx.mounted[0].config.persona, /Own the assigned scope exclusively until you settle/)
  assert.match(ctx.mounted[0].config.persona, /run checks that cover your changes/)
  assert.match(ctx.mounted[0].config.persona, /report changed files, results, risks, and blockers to the primary Agent/)
  assert.match(ctx.mounted[0].config.persona, /never claim completion when a required check fails/)
  assert.match(ctx.mounted[0].config.persona, /Own exactly one cohesive task, one acceptance target, and its directly supporting verification/)
  assert.match(ctx.mounted[0].config.persona, /Do not absorb a second independent task or any scope that overlaps another child/)
  assert.match(ctx.mounted[0].config.persona, /report the scope conflict to the primary Agent before editing/)
  assert.match(ctx.mounted[0].config.persona, /After two occurrences of the same tool or execution-protocol error/)
  assert.match(ctx.mounted[0].config.persona, /Switch to the simplest valid alternative tool call or report the blocker/)
  assert.match(ctx.mounted[0].config.persona, /never continue repeated calls that fail or produce no useful output/)
  assert.ok(ctx.mounted[0].config.persona.indexOf('Own architecture.') < ctx.mounted[0].config.persona.indexOf('You are a development specialist'))
  assert.doesNotMatch(ctx.mounted[0].config.persona, /file ownership|Do not delegate/u)
  assert.match(ctx.sections[0].text, /subagent_architect: Own architecture/)
  assert.deepEqual(ctx.sectionOrders, ['TEAM_POLICY'])
  assert.equal(ctx.sections[0].order, 600)
  assert.equal(ctx.effects[0].label, 'multi-model-orchestrator.roles')
  ctx.effects[0].dispose()
  assert.equal(ctx.sections.length, 0)
})

test('omits optional child request fields when they are not configured', async () => {
  const ctx = agentContext([agents[1]])
  await apply(ctx)
  assert.equal(ctx.mounted.length, 1)
  assert.deepEqual(ctx.mounted[0].config.agentOptions, { provider: 'beta', model: 'model-b', maxTokens: 4096 })
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
  assert.match(text, /At most 3 specialists may be configured/)
  assert.match(text, /treat them as reusable specialist tools, not as a limit on children or tasks/)
  assert.match(text, /product\/project manager/)
  assert.match(text, /Own the outcome, acceptance criteria, decomposition, assignment, integration, and final acceptance/)
  assert.match(text, /Specialists own development/)
  assert.match(text, /clarify outcomes and acceptance criteria before implementation/)
  assert.match(text, /Decompose work by complexity into any number of meaningful, independently acceptable tasks/)
  assert.match(text, /Avoid artificial or overly granular splits/)
  assert.match(text, /Map each task to the best-fit available specialist/)
  assert.match(text, /The same specialist tool may be called multiple times/)
  assert.match(text, /create a distinct child session for each task/)
  assert.match(text, /Dispatch independent tasks concurrently/)
  assert.match(text, /runtime capacity, rather than specialist roster size, is the constraint/)
  assert.match(text, /Do not keep a suitable specialist idle while you perform development/)
  assert.match(text, /only when no meaningful matching task exists or its work depends on unfinished results/)
  assert.match(text, /Never invent work merely to use every specialist/)
  assert.match(text, /exclusively owns one cohesive task and one acceptance target until it formally returns/)
  assert.match(text, /A child must not contain multiple independent or overlapping scopes/)
  assert.match(text, /Serialize tasks that overlap files, ownership, or dependencies/)
  assert.match(text, /Never implement or run equivalent tests for a target a child owns/)
  assert.match(text, /Continue only clearly non-overlapping management work/)
  assert.match(text, /Before every analysis, edit, or test step, re-check whether any child owning a related scope is still running/)
  assert.match(text, /hard phase barrier/)
  assert.match(text, /After any child returns, do not advance immediately if another child is still running/)
  assert.match(text, /status is missing, partial, or ambiguous/)
  assert.match(text, /do not begin integration or final acceptance until every relevant child has formally returned/)
  assert.match(text, /run_in_background: false when the next step depends on that child/)
  assert.match(text, /Wait for prerequisites before starting dependent work/)
  assert.match(text, /Reuse the same continuable child only for follow-up corrections to the same task/)
  assert.match(text, /create a new child for each new independent task, even when it maps to the same specialist/)
  assert.match(text, /Use foreground child calls \(set run_in_background: false\) when no independent work remains/)
  assert.match(text, /Do not repeatedly call list_agents just to pass time/)
  assert.match(text, /Several minutes of a child running alone is not a stall/)
  assert.match(text, /Treat a child that is still running and has not reported an error as healthy/)
  assert.match(text, /Elapsed time, silence, repeated or unchanged status, or another child finishing are never, alone or together, evidence of a deadlock/)
  assert.match(text, /Interrupt a child only for direct user cancellation, an explicit deadline that has arrived, a confirmed deadlock supported by concrete evidence, or verified repeated tool or execution failure/)
  assert.match(text, /Never call interrupt_agent to request an early report, shorten a wait, regain control, start integration, or avoid waiting/)
  assert.match(text, /Do not infer a deadlock from duration or lack of messages/)
  assert.match(text, /send_message queues the next turn and does not redirect current work/)
  assert.match(text, /run final acceptance checks/)
  assert.match(text, /Handle a trivial one-step change entirely yourself/)
  assert.doesNotMatch(text, /different specialist for each concurrently executable scope/)
  assert.doesNotMatch(text, /up to the available specialist count/)
  assert.doesNotMatch(text, /Treat them as available execution capacity/)
  assert.doesNotMatch(text, /file ownership|At each step boundary|cancel or mark as non-blocking|fixed delegation ratio/u)
  assert.match(roleGuidance([]), /No orchestrator specialists are configured/)
})
