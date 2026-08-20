export const LEGACY_PRESET_ID = 'orchestrator'
export const ORCHESTRATOR_PRESET_NAME = 'Multi-model orchestrator'

interface PresetRow {
  id: string
  [key: string]: unknown
}

type PresetListResponse =
  | { result: { ok: true; value: { presets: PresetRow[]; [key: string]: unknown } }; [key: string]: unknown }
  | { result: { ok: false; error: unknown }; [key: string]: unknown }

export interface AgentPresetsApi {
  list(input: Record<string, never>): Promise<PresetListResponse>
}

export function hideLegacyPresetFromCatalog(api: AgentPresetsApi) {
  const originalList = api.list
  const filteredList: AgentPresetsApi['list'] = async function (this: AgentPresetsApi, input) {
    const response = await originalList.call(this, input)
    if (!response.result.ok) return response
    return {
      ...response,
      result: {
        ...response.result,
        value: {
          ...response.result.value,
          presets: response.result.value.presets.filter(preset => !(
            preset.id === LEGACY_PRESET_ID && preset.name === ORCHESTRATOR_PRESET_NAME
          )),
        },
      },
    }
  }
  api.list = filteredList
  return () => {
    if (api.list === filteredList) api.list = originalList
  }
}
