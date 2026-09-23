import Include from '@deepseek-ai/cordis-plugin-include'
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  legacy: z.boolean().default(false),
})

export default class OrchestratorPresetInclude extends Include {
  static Config = Config

  constructor(ctx, config) {
    const baseUrl = ctx.baseUrl
    const relativePath = config.legacy ? './preset-legacy/agent.cordis.yml' : './preset/agent.cordis.yml'
    super(ctx, { path: new URL(relativePath, import.meta.url).href })
    // Resolve child DSH plugins from the declaring bundle, not this package's peer graph.
    this.ctx.baseUrl = baseUrl
  }
}
