import { DEFAULT_AGENT_DESCRIPTION } from '../src/config.js'

export const SETTINGS_NAMESPACE = 'multi-model-orchestrator'
export const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/u

export function createAgentDraft() {
  return {
    id: '',
    provider: '',
    model: '',
    description: DEFAULT_AGENT_DESCRIPTION,
    reasoningEffort: undefined,
    maxTokens: undefined,
  }
}

export function catalogOptions(groups) {
  return groups.flatMap(group => group.models.map(model => ({
    provider: group.id,
    providerName: group.name,
    model: model.id,
    modelName: model.name,
    ...(model.reasoning === undefined ? {} : {
      reasoning: {
        efforts: model.reasoning.efforts.map(effort => ({ ...effort })),
        ...(model.reasoning.defaultEffort === undefined ? {} : { defaultEffort: model.reasoning.defaultEffort }),
      },
    }),
  })))
}

export function validateAgents(agents, options = []) {
  const ids = new Set()
  for (const [index, agent] of agents.entries()) {
    if (!AGENT_ID.test(agent.id)) return 'Agent ' + (index + 1) + ' has an invalid ID.'
    if (ids.has(agent.id)) return 'Agent IDs must be unique.'
    ids.add(agent.id)
    if (!agent.provider || !agent.model) return 'Every agent must select a model.'
    if (agent.reasoningEffort !== undefined) {
      const model = options.find(option => option.provider === agent.provider && option.model === agent.model)
      if (!model?.reasoning?.efforts.some(effort => effort.id === agent.reasoningEffort)) {
        return 'Agent ' + (index + 1) + ' has an unsupported reasoning effort.'
      }
    }
    if (agent.maxTokens !== undefined && (!Number.isSafeInteger(agent.maxTokens) || agent.maxTokens < 1)) return 'Max tokens must be a positive integer.'
  }
}

export function cleanAgents(agents) {
  return agents.map(agent => ({
    id: agent.id.trim(),
    provider: agent.provider,
    model: agent.model,
    ...(agent.description.trim() === '' ? {} : { description: agent.description.trim() }),
    ...(agent.reasoningEffort === undefined ? {} : { reasoningEffort: agent.reasoningEffort }),
    ...(agent.maxTokens === undefined ? {} : { maxTokens: agent.maxTokens }),
  }))
}
