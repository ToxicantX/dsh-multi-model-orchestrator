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
    'Work on the assigned task. Inspect the relevant code, make focused changes, run checks appropriate to the change, and report changed files, results, risks, and blockers.',
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
    'Delegate when a specialist can move the work forward; handle small local tasks directly when delegation would add overhead.',
    'Start independent tasks together, and wait for prerequisites before starting dependent work.',
    'Give each child a clear objective and enough context. For follow-up work on the same task, continue the existing child instead of starting a duplicate.',
    'Review returned work, integrate it, and run final checks appropriate to the risk.',
  ].join('\n')
}

export async function apply(ctx) {
  const snapshot = ctx.multiModelOrchestrator.currentAgents()
  installReasoningEffort(ctx, snapshot)
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'multi-model-orchestrator:roles',
    order: 116.4,
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
