import z from '@deepseek-ai/schemastery'
import * as ToolSubagent from '@deepseek-ai/dsh-tool-subagent'
import { normalizeAgents } from './src/config.js'

export const name = 'multi-model-orchestrator'
export const inject = ['systemPrompt']

const AgentConfig = z.object({
  id: z.string().required(),
  provider: z.string().required(),
  model: z.string().required(),
  description: z.string(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
})

export const Config = z.object({
  agents: z.array(AgentConfig).required(),
  transport: z.string().default('spawn'),
  backgroundMode: z.union(['one-shot', 'continuable']).default('continuable'),
  maxDepth: z.natural().max(Number.MAX_SAFE_INTEGER).default(1),
})

export function roleGuidance(agents) {
  return [
    'Configured specialists:',
    ...agents.map(agent => '- subagent_' + agent.id + ': ' + agent.description),
    '',
    'Delegate independent work concurrently when useful. Give every specialist a standalone prompt with explicit ownership, constraints, and acceptance checks. Verify child results before integrating them.',
  ].join('\n')
}

export async function apply(ctx, config) {
  const agents = normalizeAgents(config.agents)
  const transport = config.transport ?? 'spawn'
  const backgroundMode = config.backgroundMode ?? 'continuable'
  const maxDepth = config.maxDepth ?? 1

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'multi-model-orchestrator:roles',
    order: 116.4,
    text: roleGuidance(agents),
  }), 'multi-model-orchestrator.roles')

  const children = agents.map(agent => ctx.plugin(ToolSubagent, {
    provider: transport,
    toolName: 'subagent_' + agent.id,
    backgroundMode,
    agentOptions: {
      provider: agent.provider,
      model: agent.model,
      ...(agent.maxTokens === undefined ? {} : { maxTokens: agent.maxTokens }),
    },
    persona: agent.description,
    maxDepth,
  }))
  await Promise.all(children.map(child => child.await()))
}
