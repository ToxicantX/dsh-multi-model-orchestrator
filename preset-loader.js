import Include from '@deepseek-ai/cordis-plugin-include'
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  legacy: z.boolean().default(false),
  specialistPersona: z.string(),
})

function findEntry(entries, id) {
  if (!Array.isArray(entries)) return undefined
  for (const entry of entries) {
    if (entry?.id === id) return entry
    if (entry?.group && Array.isArray(entry.config)) {
      const found = findEntry(entry.config, id)
      if (found !== undefined) return found
    }
  }
  return undefined
}
export default class OrchestratorPresetInclude extends Include {
  static Config = Config

  constructor(ctx, config) {
    const baseUrl = ctx.baseUrl
    const relativePath = config.legacy ? './preset-legacy/agent.cordis.yml' : './preset/agent.cordis.yml'
    super(ctx, {
      path: new URL(relativePath, import.meta.url).href,
      ...(config.specialistPersona === undefined ? {} : { patches: [
        { id: 'persona', config: { prefix: config.specialistPersona } },
        { id: 'delegation', disabled: true },
      ] }),
    })
    // Resolve child DSH plugins from the declaring bundle, not this package's peer graph.
    this.ctx.baseUrl = baseUrl
  }

  async read(forced = false) {
    const changed = await super.read(forced)
    if (changed) {
      const schedule = this.data.find(entry => entry.id === 'tool-schedule')
      if (schedule !== undefined) {
        try {
          await this.import(schedule.name)
          schedule.disabled = false
        } catch (error) {
          if (!['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code) || !error.message.includes("'" + schedule.name + "'")) throw error
        }
      }

      const listAgents = findEntry(this.data, 'tool-subagent-list-agents')
      if (listAgents !== undefined) {
        try {
          await this.import(listAgents.name)
          listAgents.disabled = false
        } catch (error) {
          const expectedErrors = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED']
          if (!expectedErrors.includes(error.code)) throw error
          listAgents.disabled = true
        }
      }
    }
    return changed
  }
}
