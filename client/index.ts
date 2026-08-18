import { SettingsOrchestratorSection } from './SettingsOrchestratorSection.tsx'

const NS = 'settings.orchestrator'
const zh = { nav: 'Agent 编排', title: 'Agent 编排', loading: '正在加载…', retry: '重试', add: '添加 Agent', noModels: 'DSH 当前没有可用模型，请先在“模型”中完成配置。', empty: '尚未配置 Agent。', id: 'Agent ID', model: '模型', chooseModel: '选择已配置模型', description: '开发职责', reasoningEffort: '推理等级（可选）', modelDefault: '使用模型默认值', maxTokens: '最大输出 Token（可选）', remove: '删除 Agent', save: '保存', saving: '正在保存…' }
const en = { nav: 'Agent orchestration', title: 'Agent orchestration', loading: 'Loading…', retry: 'Retry', add: 'Add agent', noModels: 'No DSH models are available. Configure a model first.', empty: 'No agents configured.', id: 'Agent ID', model: 'Model', chooseModel: 'Choose a configured model', description: 'Development scope', reasoningEffort: 'Reasoning effort (optional)', modelDefault: 'Use model default', maxTokens: 'Maximum output tokens (optional)', remove: 'Remove agent', save: 'Save', saving: 'Saving…' }

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'multi-model-orchestrator: locale')
  const connection = ctx.get('connection')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'orchestrator', order: 15, label: () => t('nav'),
    inject: () => ({ api: connection.api, t }),
  }, SettingsOrchestratorSection))
}

export { catalogOptions, cleanAgents, validateAgents } from './state.ts'
