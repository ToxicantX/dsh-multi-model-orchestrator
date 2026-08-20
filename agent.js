import z from '@deepseek-ai/schemastery'
import * as ToolSubagent from '@deepseek-ai/dsh-tool-subagent'

export const name = 'multi-model-orchestrator-agent'
export const inject = ['systemPrompt', 'multiModelOrchestrator']
export const Config = z.object({})

const SPECIALIST_ID = /^Your orchestrator Agent ID is "([a-z][a-z0-9_-]{0,47})"\.$/u

export function specialistPersona(agent) {
  return [
    'Your orchestrator Agent ID is "' + agent.id + '".',
    agent.description,
    'You are a development specialist. Own the assigned scope exclusively until you settle. Inspect the relevant code, make focused changes, run checks that cover your changes, and report changed files, results, risks, and blockers to the primary Agent; never claim completion when a required check fails.',
  ].join('\n\n')
}

function currentSpecialistId(agent) {
  const session = agent?.session
  if (session === undefined) return undefined
  const events = session.events.slice(session.header.seedLength ?? 0)
  const descriptor = events.find(event => event.type === 'subagent/descriptor')?.data
  if (descriptor?.mode !== 'continuable' || typeof descriptor.persona !== 'string') return undefined
  return descriptor.persona.split('\n', 1)[0]?.match(SPECIALIST_ID)?.[1]
}

function installReasoningEffort(ctx, agents) {
  const efforts = new Map(agents.flatMap(agent => agent.reasoningEffort === undefined ? [] : [[agent.id, agent.reasoningEffort]]))
  if (efforts.size === 0) return
  ctx.on('agent/request', async ({ agent }, next) => {
    const resolved = await next()
    const reasoningEffort = efforts.get(currentSpecialistId(agent))
    return reasoningEffort === undefined ? resolved : { ...resolved, reasoningEffort }
  })
}

export function roleGuidance(agents) {
  if (agents.length === 0) return 'No orchestrator specialists are configured. Add agents in Settings > Orchestrator, then create a new session.'
  return [
    'Available specialists:',
    ...agents.map(agent => '- subagent_' + agent.id + ': ' + agent.description),
    '',
    'You have ' + agents.length + ' configured development specialists. Treat them as available execution capacity.',
    'You are the product/project manager. Own the outcome, acceptance criteria, decomposition, assignment, integration, and final acceptance. Specialists own development.',
    'For non-trivial work, clarify outcomes and acceptance criteria before implementation. Map every meaningful separable scope to the best-fit available specialist, using a different specialist for each concurrently executable scope.',
    'Dispatch all independent matched scopes together, up to the available specialist count. Do not keep a suitable specialist idle while you perform development. A specialist may remain idle only when no meaningful matching scope exists or its work depends on unfinished results. Never invent work merely to use every specialist.',
    'Each child exclusively owns its assigned scope and acceptance target until it formally returns. Never implement or run equivalent tests for a target a child owns. Continue only clearly non-overlapping management work; otherwise wait.',
    'Before every analysis, edit, or test step, re-check whether any child owning a related scope is still running. A running child is a hard phase barrier: do not overlap its analysis, implementation, or tests, and do not begin integration or final acceptance until every relevant child has formally returned.',
    'After any child returns, do not advance immediately if another child is still running. Allow a short additional observation window, then re-check every child status; if status is missing, partial, or ambiguous, keep waiting and re-checking rather than inferring completion.',
    'Wait for prerequisites before starting dependent work.',
    'Set run_in_background: false when the next step depends on that child or when no clearly non-overlapping work remains. Reuse the same continuable child for follow-up on the same task instead of starting a duplicate.',
    'After all relevant children return, review, integrate, and run final acceptance checks. Handle a trivial one-step change entirely yourself.',
  ].join('\n')
}

export async function apply(ctx) {
  const snapshot = ctx.multiModelOrchestrator.currentAgents()
  installReasoningEffort(ctx, snapshot)
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'multi-model-orchestrator:roles',
    order: 116.6,
    text: roleGuidance(snapshot),
  }), 'multi-model-orchestrator.roles')

  const children = snapshot.map(agent => ctx.plugin(ToolSubagent, {
    provider: 'spawn',
    toolName: 'subagent_' + agent.id,
    backgroundMode: 'continuable',
    agentOptions: {
      provider: agent.provider,
      model: agent.model,
      ...(agent.maxTokens === undefined ? {} : { maxTokens: agent.maxTokens }),
    },
    persona: specialistPersona(agent),
    maxDepth: 1,
  }))
  await Promise.all(children.map(child => child.await()))
}

apply.inject = inject
apply.Config = Config
export default apply
