import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MAX_AGENT_COUNT } from '../src/config.js'
import {
  agentCountWarning,
  catalogOptions,
  cleanAgents,
  createAgentDraft,
  type AgentDraft,
  type AgentInput,
  type ClientContext,
  type ModelGroup,
  validateAgents,
  withRenderKey,
} from './state.ts'

const SETTINGS_ENDPOINT = '/plugins/dsh-multi-model-orchestrator/settings'

type SettingsResponse = { agents?: Array<Record<string, unknown>> }

async function settingsRequest(init?: RequestInit, signal?: AbortSignal): Promise<SettingsResponse> {
  const response = await fetch(SETTINGS_ENDPOINT, { ...init, signal })
  const value = await response.json() as SettingsResponse & { error?: string }
  if (!response.ok) throw new Error(value.error ?? 'Agent settings request failed')
  return value
}

function hydrateAgent(agent: Record<string, unknown>): AgentDraft {
  const value: AgentInput = {
    id: String(agent.id ?? ''),
    provider: String(agent.provider ?? ''),
    model: String(agent.model ?? ''),
    description: String(agent.description ?? ''),
    ...(agent.reasoningEffort === undefined ? {} : { reasoningEffort: String(agent.reasoningEffort) }),
    ...(agent.maxTokens === undefined ? {} : { maxTokens: Number(agent.maxTokens) }),
  }
  return withRenderKey(value)
}

const shell: CSSProperties = { padding: '4px 0 28px', maxWidth: 920 }
const toolbar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }
const list: CSSProperties = { display: 'grid', gap: 10 }
const card: CSSProperties = { border: '1px solid var(--border-color, #d8dce3)', borderRadius: 8, padding: 14, background: 'var(--panel-bg, transparent)' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }
const field: CSSProperties = { display: 'grid', gap: 6, minWidth: 0 }
const control: CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 36, border: '1px solid var(--border-color, #c9ced8)', borderRadius: 6, padding: '7px 9px', color: 'inherit', background: 'var(--input-bg, transparent)', font: 'inherit' }
const selectControl: CSSProperties = { ...control, colorScheme: 'light dark' }
const nativeOption: CSSProperties = { color: 'CanvasText', backgroundColor: 'Canvas' }
const actions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }
const button: CSSProperties = { minHeight: 36, minWidth: 88, border: '1px solid var(--border-color, #c9ced8)', borderRadius: 6, padding: '7px 12px', color: 'inherit', background: 'var(--button-bg, transparent)', cursor: 'pointer' }
const primary: CSSProperties = { ...button, background: 'var(--accent-color, #1769e0)', borderColor: 'var(--accent-color, #1769e0)', color: '#fff' }
const iconButton: CSSProperties = { ...button, minWidth: 36, width: 36, padding: 0, fontSize: 20, lineHeight: 1 }

function modelValue(agent: Pick<AgentInput, 'provider' | 'model'>) {
  return JSON.stringify([agent.provider, agent.model])
}

export function SettingsOrchestratorSection({ api, t }: ClientContext) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentDraft[]>([])
  const [groups, setGroups] = useState<ModelGroup[]>([])
  const [writable, setWritable] = useState(false)
  const [dirty, setDirty] = useState(false)
  const alive = useRef(false)
  const requestId = useRef(0)
  const activeController = useRef<AbortController | null>(null)
  const options = useMemo(() => catalogOptions(groups), [groups])

  function beginRequest() {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    return { controller, id: ++requestId.current }
  }

  function applyIfCurrent(id: number, callback: () => void) {
    if (alive.current && id === requestId.current) callback()
  }

  async function load() {
    const { controller, id } = beginRequest()
    setStatus('loading')
    setError(null)
    setNotice(null)
    try {
      const [settingsValue, modelsResponse] = await Promise.all([
        settingsRequest(undefined, controller.signal),
        api.llm.models({}),
      ])
      if (!modelsResponse.result.ok) throw new Error(modelsResponse.result.error.message)
      const modelGroups = modelsResponse.result.value.groups
      const stored = Array.isArray(settingsValue.agents) ? settingsValue.agents : []
      applyIfCurrent(id, () => {
        setAgents(stored.map(hydrateAgent))
        setGroups(modelGroups)
        setWritable(true)
        setDirty(false)
        setStatus('ready')
      })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      applyIfCurrent(id, () => {
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      })
    } finally {
      if (activeController.current === controller) activeController.current = null
    }
  }

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
      requestId.current += 1
      activeController.current?.abort()
      activeController.current = null
    }
  }, [])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function markChanged() {
    setDirty(true)
    setError(null)
    setNotice(null)
  }

  function update(index: number, patch: Partial<AgentDraft>) {
    setAgents(current => current.map((agent, position) => position === index ? { ...agent, ...patch } : agent))
    markChanged()
  }

  function add() {
    setAgents(current => current.length >= MAX_AGENT_COUNT ? current : [...current, createAgentDraft()])
    markChanged()
  }

  function remove(index: number) {
    setAgents(current => current.filter((_, position) => position !== index))
    markChanged()
  }

  async function save() {
    const validation = validateAgents(agents, options, t)
    if (validation !== undefined) {
      setError(validation)
      setNotice(null)
      return
    }

    const { controller, id } = beginRequest()
    setStatus('saving')
    setError(null)
    setNotice(null)
    try {
      const saved = await settingsRequest({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agents: cleanAgents(agents) }),
      }, controller.signal)
      applyIfCurrent(id, () => {
        if (Array.isArray(saved.agents)) setAgents(saved.agents.map(hydrateAgent))
        setDirty(false)
        setStatus('ready')
        setNotice(t('saved'))
      })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      applyIfCurrent(id, () => {
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('ready')
      })
    } finally {
      if (activeController.current === controller) activeController.current = null
    }
  }

  if (status === 'loading') return <div style={shell}>{t('loading')}</div>
  if (status === 'error') return <div style={shell}><p role="alert">{error}</p><button style={button} onClick={() => void load()}>{t('retry')}</button></div>

  return <div style={shell}>
    <div style={toolbar}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{t('title')}</h2>
      <button style={button} onClick={add} disabled={!writable || status === 'saving' || agents.length >= MAX_AGENT_COUNT} title={t('add')}>
        <span aria-hidden="true">+</span> {t('add')}
      </button>
    </div>
    {agentCountWarning(agents.length) && <p role="status">{t('agentCountWarning')}</p>}
    {options.length === 0 && <p role="status">{t('noModels')}</p>}
    {agents.length === 0 && <p role="status">{t('empty')}</p>}
    <div style={list}>
      {agents.map((agent, index) => {
        const selectedModel = options.find(option => option.provider === agent.provider && option.model === agent.model)
        const reasoning = selectedModel?.reasoning
        const stale = agent.provider !== '' && agent.model !== '' && selectedModel === undefined
        return <div style={card} key={agent.renderKey}>
          <div style={grid}>
            <label style={field}>
              <span>{t('id')}</span>
              <input style={control} value={agent.id} maxLength={48} onChange={event => update(index, { id: event.target.value })} disabled={!writable || status === 'saving'} />
            </label>
            <label style={field}>
              <span>{t('model')}</span>
              <select style={selectControl} value={modelValue(agent)} aria-invalid={stale || undefined} title={stale ? t('unavailableModel') : selectedModel === undefined ? t('chooseModel') : selectedModel.modelName + ' (' + selectedModel.model + ')'} onChange={event => {
                const [provider = '', model = ''] = JSON.parse(event.target.value) as string[]
                update(index, { provider, model, reasoningEffort: undefined })
              }} disabled={!writable || status === 'saving'}>
                <option style={nativeOption} value={JSON.stringify(['', ''])}>{t('chooseModel')}</option>
                {stale && <option style={nativeOption} value={modelValue(agent)}>{t('unavailableModel')}: {agent.provider}/{agent.model}</option>}
                {groups.map(group => <optgroup style={nativeOption} key={group.id} label={group.name}>
                  {group.models.map(model => <option style={nativeOption} key={model.id} value={JSON.stringify([group.id, model.id])}>{model.name} ({model.id})</option>)}
                </optgroup>)}
              </select>
            </label>
            {reasoning !== undefined && <label style={field}>
              <span>{t('reasoningEffort')}</span>
              <select style={selectControl} value={agent.reasoningEffort ?? ''} title={agent.reasoningEffort === undefined ? t('modelDefault') : reasoning.efforts.find(effort => effort.id === agent.reasoningEffort)?.name ?? agent.reasoningEffort} onChange={event => update(index, { reasoningEffort: event.target.value === '' ? undefined : event.target.value })} disabled={!writable || status === 'saving'}>
                <option style={nativeOption} value="">{t('modelDefault')}{reasoning.defaultEffort === undefined ? '' : ' (' + (reasoning.efforts.find(effort => effort.id === reasoning.defaultEffort)?.name ?? reasoning.defaultEffort) + ')'}</option>
                {reasoning.efforts.map(effort => <option style={nativeOption} key={effort.id} value={effort.id}>{effort.name}</option>)}
              </select>
            </label>}
            <label style={{ ...field, gridColumn: '1 / -1' }}>
              <span>{t('description')}</span>
              <textarea style={{ ...control, resize: 'vertical', minHeight: 72 }} value={agent.description} onChange={event => update(index, { description: event.target.value })} disabled={!writable || status === 'saving'} />
            </label>
            <label style={field}>
              <span>{t('maxTokens')}</span>
              <input style={control} type="number" min="1" step="1" value={agent.maxTokens ?? ''} onChange={event => update(index, { maxTokens: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={!writable || status === 'saving'} />
            </label>
          </div>
          <div style={actions}><button type="button" style={iconButton} onClick={() => remove(index)} disabled={!writable || status === 'saving'} aria-label={t('remove')} title={t('remove')}>×</button></div>
        </div>
      })}
    </div>
    {error && <p role="alert" style={{ color: 'var(--danger-color, #c93434)' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div style={{ ...actions, marginTop: 18 }}>
      <button style={primary} onClick={() => void save()} disabled={!writable || !dirty || status === 'saving'} aria-busy={status === 'saving'}>{status === 'saving' ? t('saving') : t('save')}</button>
    </div>
  </div>
}
