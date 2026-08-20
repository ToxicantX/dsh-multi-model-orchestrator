import { utimesSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { MAX_AGENT_COUNT, normalizeAgents } from './src/config.js'
import { DEFAULT_PRESET_ID, provisionLegacyPreset, provisionPreset } from './src/preset.js'

export const name = 'multi-model-orchestrator-settings'
export const inject = ['settings', 'webServer']
export const ORCHESTRATOR_SETTINGS_NAMESPACE = 'multi-model-orchestrator'
export const ORCHESTRATOR_SETTINGS_ENDPOINT = '/plugins/dsh-multi-model-orchestrator/settings'

export const AgentSettingsSchema = z.object({
  id: z.string().required(),
  provider: z.string().required(),
  model: z.string().required(),
  description: z.string(),
  reasoningEffort: z.string(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
})

export const SettingsSchema = z.object({ agents: z.array(AgentSettingsSchema).default([]) })
export const Config = z.object({
  agents: z.array(AgentSettingsSchema).default([]),
  presetPath: z.string(),
})

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

async function readJson(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (Buffer.byteLength(body) > 64 * 1024) throw new Error('request body exceeds 64 KiB')
  }
  return JSON.parse(body)
}

function sameOrigin(req) {
  const origin = req.headers.origin
  return origin === undefined || origin === 'http://' + req.headers.host || origin === 'https://' + req.headers.host
}

export class MultiModelOrchestratorSettings {
  constructor(ctx, config) {
    const entry = { agents: config.agents ?? [] }
    this.source = () => entry
    this.scope = undefined
    const refreshGeneration = () => {
      if (config.presetPath === undefined) return
      try {
        const now = new Date()
        utimesSync(config.presetPath, now, now)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
    }
    ctx.effect(() => {
      this.scope = ctx.settings.register(ORCHESTRATOR_SETTINGS_NAMESPACE, SettingsSchema, {
        base: entry,
        validate: value => { normalizeAgents(value.agents, { allowEmpty: true, allowOverLimit: true }) },
      })
      this.source = () => this.scope.get()
      refreshGeneration()
      return this.scope.watch(refreshGeneration)
    })
  }

  configuredAgents() {
    return normalizeAgents(this.source().agents, { allowEmpty: true, allowOverLimit: true }).map(agent => ({ ...agent }))
  }

  currentAgents() {
    return this.configuredAgents().slice(0, MAX_AGENT_COUNT)
  }

  async replaceAgents(agents) {
    if (this.scope === undefined) throw new Error('orchestrator settings are not ready')
    const normalized = normalizeAgents(agents, { allowEmpty: true })
    await this.scope.replace({ agents: normalized })
    return this.currentAgents()
  }
}

export function settingsRoute(service) {
  return {
    kind: 'exact',
    path: ORCHESTRATOR_SETTINGS_ENDPOINT,
    async handler(req, res) {
      try {
        if (!sameOrigin(req)) return sendJson(res, 403, { error: 'cross-origin request rejected' })
        if (req.method === 'GET' || req.method === 'HEAD') {
          return sendJson(res, 200, req.method === 'HEAD' ? {} : { agents: service.configuredAgents() })
        }
        if (req.method !== 'PUT') return sendJson(res, 405, { error: 'method not allowed' })
        if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          return sendJson(res, 415, { error: 'content-type must be application/json' })
        }
        const value = await readJson(req)
        if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'agents')) {
          return sendJson(res, 400, { error: 'request must contain only agents' })
        }
        return sendJson(res, 200, { agents: await service.replaceAgents(value.agents) })
      } catch (error) {
        return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}

export function apply(ctx, config) {
  if (config.presetPath !== undefined) {
    const target = dirname(config.presetPath)
    provisionPreset({ target })
    if (basename(target) === DEFAULT_PRESET_ID) provisionLegacyPreset({ primaryTarget: target })
  }
  const service = new MultiModelOrchestratorSettings(ctx, config)
  ctx.provide('multiModelOrchestrator', service)
  ctx.effect(() => ctx.webServer.register(settingsRoute(service)))
}

apply.inject = inject
apply.Config = Config
export default apply
