import Include from '@deepseek-ai/cordis-plugin-include'
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  legacy: z.boolean().default(false),
  specialistPersona: z.string(),
})

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
    }
    return changed
  }
}
