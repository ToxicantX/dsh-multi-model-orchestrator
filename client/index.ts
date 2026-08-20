import { SettingsOrchestratorSection } from './SettingsOrchestratorSection.tsx'
import { hideLegacyPresetFromCatalog, type AgentPresetsApi } from './presetCatalog.ts'
import type { ClientContext, Translation } from './state.ts'

const NS = 'settings.orchestrator'
const zh = {
  nav: 'Agent 编排',
  title: 'Agent 编排',
  loading: '正在加载…',
  retry: '重试',
  add: '添加 Agent',
  noModels: 'DSH 当前没有可用模型，请先在“模型”中完成配置。',
  empty: '尚未配置 Agent。',
  id: 'Agent ID',
  model: '模型',
  chooseModel: '选择已配置模型',
  unavailableModel: '当前模型不可用',
  description: '开发职责',
  reasoningEffort: '推理等级（可选）',
  modelDefault: '使用模型默认值',
  maxTokens: '最大输出 Token（可选）',
  remove: '删除 Agent',
  save: '保存',
  saving: '正在保存…',
  saved: '配置已保存。',
  legacyAgentLimit: '此旧配置超过 3 个 Agent。当前仅启用前 3 个；请删除多余 Agent 后保存。',
  agentCountExceeded: 'Agent 数量不能超过 3 个。',
  invalidAgentId: 'Agent ID 无效，位置：',
  duplicateAgentId: 'Agent ID 必须唯一。',
  modelRequired: '每个 Agent 都必须选择模型。',
  modelUnavailable: '配置的模型当前不可用，Agent 位置：',
  unsupportedReasoning: '推理等级不受所选模型支持，Agent 位置：',
  maxTokensPositive: '最大输出 Token 必须是正整数。',
}
const en = {
  nav: 'Agent orchestration',
  title: 'Agent orchestration',
  loading: 'Loading…',
  retry: 'Retry',
  add: 'Add agent',
  noModels: 'No DSH models are available. Configure a model first.',
  empty: 'No agents configured.',
  id: 'Agent ID',
  model: 'Model',
  chooseModel: 'Choose a configured model',
  unavailableModel: 'Unavailable configured model',
  description: 'Development scope',
  reasoningEffort: 'Reasoning effort (optional)',
  modelDefault: 'Use model default',
  maxTokens: 'Maximum output tokens (optional)',
  remove: 'Remove agent',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Configuration saved.',
  legacyAgentLimit: 'This legacy roster exceeds 3 Agents. Only the first 3 are active; remove the extras before saving.',
  agentCountExceeded: 'No more than 3 agents can be configured.',
  invalidAgentId: 'The Agent ID is invalid at position:',
  duplicateAgentId: 'Agent IDs must be unique.',
  modelRequired: 'Every agent must select a model.',
  modelUnavailable: 'The configured model is unavailable at Agent position:',
  unsupportedReasoning: 'The reasoning effort is unsupported at Agent position:',
  maxTokensPositive: 'Maximum output tokens must be a positive integer.',
}

interface ClientPluginContext {
  effect(factory: () => unknown, label: string): unknown
  locale: {
    register(namespace: string, locales: Record<string, Record<string, string>>): unknown
    bind(namespace: string): Translation
  }
  get(name: 'connection'): { api: ClientContext['api'] & { agentPresets: AgentPresetsApi } }
  slots: {
    inject(name: string, factory: () => unknown): unknown
    register(options: {
      name: string
      id: string
      order: number
      label: () => string
      inject: () => ClientContext
    }, component: typeof SettingsOrchestratorSection): unknown
  }
}

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: ClientPluginContext) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'multi-model-orchestrator: locale')
  const connection = ctx.get('connection')
  ctx.effect(() => hideLegacyPresetFromCatalog(connection.api.agentPresets), 'multi-model-orchestrator: hide legacy preset')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'orchestrator',
    order: 15,
    label: () => t('nav'),
    inject: () => ({ api: connection.api, t }),
  }, SettingsOrchestratorSection))
}

export { catalogOptions, cleanAgents, validateAgents } from './state.ts'
