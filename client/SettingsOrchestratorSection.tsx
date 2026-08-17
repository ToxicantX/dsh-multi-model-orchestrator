import React, { useEffect, useMemo, useState } from 'react'
import { catalogOptions, cleanAgents, validateAgents } from './state.ts'

const SETTINGS_ENDPOINT = '/plugins/dsh-multi-model-orchestrator/settings'

async function settingsRequest(init) {
  const response = await fetch(SETTINGS_ENDPOINT, init)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error ?? 'Agent settings request failed')
  return value
}

const shell = { padding: '4px 0 28px', maxWidth: 920 }
const toolbar = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }
const list = { display: 'grid', gap: 10 }
const card = { border: '1px solid var(--border-color, #d8dce3)', borderRadius: 8, padding: 14, background: 'var(--panel-bg, transparent)' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }
const field = { display: 'grid', gap: 6, minWidth: 0 }
const control = { boxSizing: 'border-box', width: '100%', minHeight: 36, border: '1px solid var(--border-color, #c9ced8)', borderRadius: 6, padding: '7px 9px', color: 'inherit', background: 'var(--input-bg, transparent)', font: 'inherit' }
const actions = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }
const button = { minHeight: 36, border: '1px solid var(--border-color, #c9ced8)', borderRadius: 6, padding: '7px 12px', color: 'inherit', background: 'var(--button-bg, transparent)', cursor: 'pointer' }
const primary = { ...button, background: 'var(--accent-color, #1769e0)', borderColor: 'var(--accent-color, #1769e0)', color: '#fff' }
const iconButton = { ...button, width: 36, padding: 0, fontSize: 20, lineHeight: 1 }

function emptyAgent() { return { id: '', provider: '', model: '', description: '', maxTokens: undefined } }
function modelValue(agent) { return JSON.stringify([agent.provider, agent.model]) }

export function SettingsOrchestratorSection({ api, t }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [agents, setAgents] = useState([])
  const [groups, setGroups] = useState([])
  const [writable, setWritable] = useState(false)
  const [dirty, setDirty] = useState(false)
  const options = useMemo(() => catalogOptions(groups), [groups])

  async function load() {
    setStatus('loading'); setError(null)
    try {
      const [settingsValue, modelsResponse] = await Promise.all([settingsRequest(), api.llm.models({})])
      if (!modelsResponse.result.ok) throw new Error(modelsResponse.result.error.message)
      const stored = Array.isArray(settingsValue.agents) ? settingsValue.agents : []
      setAgents(stored.map(agent => ({ ...agent, description: agent.description ?? '' })))
      setGroups(modelsResponse.result.value.groups)
      setWritable(true)
      setDirty(false); setStatus('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error')
    }
  }

  useEffect(() => { void load() }, [])

  function update(index, patch) {
    setAgents(current => current.map((agent, position) => position === index ? { ...agent, ...patch } : agent))
    setDirty(true); setError(null)
  }

  function add() { setAgents(current => [...current, emptyAgent()]); setDirty(true); setError(null) }
  function remove(index) { setAgents(current => current.filter((_, position) => position !== index)); setDirty(true); setError(null) }

  async function save() {
    const message = validateAgents(agents)
    if (message !== undefined) { setError(message); return }
    setStatus('saving'); setError(null)
    try {
      await settingsRequest({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agents: cleanAgents(agents) }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause)); setStatus('ready')
    }
  }

  if (status === 'loading') return <div style={shell}>{t('loading')}</div>
  if (status === 'error') return <div style={shell}><p role="alert">{error}</p><button style={button} onClick={() => void load()}>{t('retry')}</button></div>

  return <div style={shell}>
    <div style={toolbar}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{t('title')}</h2>
      <button style={button} onClick={add} disabled={!writable} title={t('add')}><span aria-hidden="true">+</span> {t('add')}</button>
    </div>
    {options.length === 0 && <p role="status">{t('noModels')}</p>}
    {agents.length === 0 && <p role="status">{t('empty')}</p>}
    <div style={list}>
      {agents.map((agent, index) => <div style={card} key={index}>
        <div style={grid}>
          <label style={field}><span>{t('id')}</span><input style={control} value={agent.id} maxLength={48} onChange={event => update(index, { id: event.target.value })} disabled={!writable} /></label>
          <label style={field}><span>{t('model')}</span><select style={control} value={modelValue(agent)} onChange={event => { const [provider, model] = JSON.parse(event.target.value); update(index, { provider, model }) }} disabled={!writable}>
            <option value={JSON.stringify(['', ''])}>{t('chooseModel')}</option>
            {groups.map(group => <optgroup key={group.id} label={group.name}>{group.models.map(model => <option key={model.id} value={JSON.stringify([group.id, model.id])}>{model.name} ({model.id})</option>)}</optgroup>)}
          </select></label>
          <label style={{ ...field, gridColumn: '1 / -1' }}><span>{t('description')}</span><textarea style={{ ...control, resize: 'vertical', minHeight: 72 }} value={agent.description} onChange={event => update(index, { description: event.target.value })} disabled={!writable} /></label>
          <label style={field}><span>{t('maxTokens')}</span><input style={control} type="number" min="1" step="1" value={agent.maxTokens ?? ''} onChange={event => update(index, { maxTokens: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={!writable} /></label>
        </div>
        <div style={actions}><button type="button" style={iconButton} onClick={() => remove(index)} disabled={!writable} aria-label={t('remove')} title={t('remove')}>×</button></div>
      </div>)}
    </div>
    {error && <p role="alert" style={{ color: 'var(--danger-color, #c93434)' }}>{error}</p>}
    <div style={{ ...actions, marginTop: 18 }}><button style={primary} onClick={() => void save()} disabled={!writable || !dirty || status === 'saving'}>{status === 'saving' ? t('saving') : t('save')}</button></div>
  </div>
}
