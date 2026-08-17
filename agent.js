import z from '@deepseek-ai/schemastery'
import * as ToolSubagent from '@deepseek-ai/dsh-tool-subagent'

export const name = 'multi-model-orchestrator-agent'
export const inject = ['systemPrompt', 'multiModelOrchestrator']
export const Config = z.object({})

export function roleGuidance(agents) {
  if (agents.length === 0) return 'No orchestrator specialists are configured. Add agents in Settings > Orchestrator, then create a new session.'
  return [
    'Configured specialists:',
    ...agents.map(agent => '- subagent_' + agent.id + ': ' + agent.description),
    '',
    'Delegate independent work concurrently when useful. Give every specialist a standalone prompt with explicit ownership, constraints, and acceptance checks. Verify child results before integrating them.',
  ].join('\n')
}

export async function apply(ctx) {
  const snapshot = ctx.multiModelOrchestrator.currentAgents()
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
    persona: agent.description,
    maxDepth: 1,
  }))
  await Promise.all(children.map(child => child.await()))
}

apply.inject = inject
apply.Config = Config
export default apply
