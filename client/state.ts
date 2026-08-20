import { AGENT_ID, DEFAULT_AGENT_DESCRIPTION, MAX_AGENT_COUNT } from '../src/config.js'

export const SETTINGS_NAMESPACE = 'multi-model-orchestrator'

export interface ReasoningEffort {
  id: string
  name: string
}

export interface Reasoning {
  efforts: ReasoningEffort[]
  defaultEffort?: string
}

export interface ModelOption {
  id: string
  name: string
  reasoning?: Reasoning
}

export interface ModelGroup {
  id: string
  name: string
  models: ModelOption[]
}

export interface CatalogOption {
  provider: string
  providerName: string
  model: string
  modelName: string
  reasoning?: Reasoning
}

export interface AgentInput {
  id: string
  provider: string
  model: string
  description: string
  reasoningEffort?: string
  maxTokens?: number
}

export type AgentSettings = Omit<AgentInput, 'description'> & { description?: string }
export type AgentDraft = AgentInput & { renderKey: string }
export type Translation = (key: string) => string

type ModelsResult =
  | { result: { ok: true; value: { groups: ModelGroup[] } } }
  | { result: { ok: false; error: { message: string } } }

export interface ModelsApi {
  models(input: Record<string, never>): Promise<ModelsResult>
}

export interface ClientContext {
  api: { llm: ModelsApi }
  t: Translation
}

let nextRenderKey = 0

function createRenderKey() {
  nextRenderKey += 1
  return 'agent-' + nextRenderKey
}

export function createAgentDraft(): AgentDraft {
  return {
    id: '',
    provider: '',
    model: '',
    description: DEFAULT_AGENT_DESCRIPTION,
    reasoningEffort: undefined,
    maxTokens: undefined,
    renderKey: createRenderKey(),
  }
}

export function withRenderKey(agent: AgentInput): AgentDraft {
  return { ...agent, renderKey: createRenderKey() }
}

export function catalogOptions(groups: ModelGroup[]): CatalogOption[] {
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

function validationMessage(t: Translation | undefined, key: string, fallback: string, index?: number) {
  const text = t === undefined ? fallback : t(key)
  return index === undefined ? text : text + ' ' + (index + 1)
}

export function validateAgents(agents: readonly AgentInput[], options?: readonly CatalogOption[], t?: Translation): string | undefined {
  if (agents.length > MAX_AGENT_COUNT) {
    return validationMessage(t, 'agentCountExceeded', 'Agents must not exceed ' + MAX_AGENT_COUNT + '.')
  }

  const ids = new Set<string>()
  for (const [index, agent] of agents.entries()) {
    const id = agent.id.trim()
    if (!AGENT_ID.test(id)) return validationMessage(t, 'invalidAgentId', 'Agent has an invalid ID.', index)
    if (ids.has(id)) return validationMessage(t, 'duplicateAgentId', 'Agent IDs must be unique.')
    ids.add(id)

    if (!agent.provider || !agent.model) return validationMessage(t, 'modelRequired', 'Every agent must select a model.')
    const selected = options?.find(option => option.provider === agent.provider && option.model === agent.model)
    if (options !== undefined && selected === undefined) {
      return validationMessage(t, 'modelUnavailable', 'Agent uses a model that is no longer available.', index)
    }
    if (agent.reasoningEffort !== undefined && !selected?.reasoning?.efforts.some(effort => effort.id === agent.reasoningEffort)) {
      return validationMessage(t, 'unsupportedReasoning', 'Agent has an unsupported reasoning effort.', index)
    }
    if (agent.maxTokens !== undefined && (!Number.isSafeInteger(agent.maxTokens) || agent.maxTokens < 1)) {
      return validationMessage(t, 'maxTokensPositive', 'Max tokens must be a positive integer.')
    }
  }
}

export function cleanAgents(agents: readonly AgentInput[]): AgentSettings[] {
  return agents.map(agent => ({
    id: agent.id.trim(),
    provider: agent.provider,
    model: agent.model,
    ...(agent.description.trim() === '' ? {} : { description: agent.description.trim() }),
    ...(agent.reasoningEffort === undefined ? {} : { reasoningEffort: agent.reasoningEffort }),
    ...(agent.maxTokens === undefined ? {} : { maxTokens: agent.maxTokens }),
  }))
}
