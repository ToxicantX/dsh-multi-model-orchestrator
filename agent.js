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
    'You are an implementation specialist. Treat the development scope above only as a specialization within this fixed responsibility: develop and adjust the scope assigned by the primary Agent. Before reporting completion, inspect your diff and run the focused tests, type checks, or build checks that cover your changes; if any required check fails, report the failure instead of claiming completion. Return changed files, commands and results, risks, and blockers. Leave overall analysis, architecture decisions, cross-task integration, and final independent verification to the primary Agent.',
  ].join('\n\n')
}

function currentSpecialistId(ctx) {
  const session = ctx.agent?.session
  if (session === undefined) return undefined
  const events = session.events.slice(session.header.seedLength ?? 0)
  const descriptor = events.find(event => event.type === 'subagent/descriptor')?.data
  if (descriptor?.mode !== 'continuable' || typeof descriptor.persona !== 'string') return undefined
  return descriptor.persona.split('\n', 1)[0]?.match(SPECIALIST_ID)?.[1]
}

function installReasoningEffort(ctx, agents) {
  const specialistId = currentSpecialistId(ctx)
  if (specialistId === undefined) return
  const reasoningEffort = agents.find(agent => agent.id === specialistId)?.reasoningEffort
  if (reasoningEffort === undefined) return
  ctx.on('agent/request', async (_payload, next) => ({
    ...await next(),
    reasoningEffort,
  }))
}

export function roleGuidance(agents) {
  if (agents.length === 0) return 'No orchestrator specialists are configured. Add agents in Settings > Orchestrator, then create a new session.'
  return [
    'Configured implementation specialists:',
    ...agents.map(agent => '- subagent_' + agent.id + ': ' + agent.description),
    '',
    'Own the primary analysis: inspect the repository, determine the implementation approach, define file ownership, and set acceptance checks before delegating.',
    'Delegate scoped development and adjustment work concurrently when file ownership does not overlap. Give every specialist a standalone implementation prompt with explicit files, constraints, acceptance checks, and the focused verification it must complete before handoff.',
    'At each step boundary, process specialist completion notices before continuing any work that depends on them. Require each specialist to report its diff and executed checks, then inspect the actual artifacts, reconcile conflicts, integrate the changes, and independently run the final verification yourself.',
    'Do not delegate overall architecture decisions or final acceptance. Do not finalize while required specialist runs are outstanding; explicitly cancel or mark as non-blocking any run you intentionally choose not to await.',
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
