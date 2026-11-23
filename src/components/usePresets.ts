import { BUILT_IN_PRESETS, createPreset, parsePresets, PRESETS_KEY } from '../presets'
import { useStored } from '../storage'

export function usePresets() {
  const [custom, setCustom] = useStored(PRESETS_KEY, parsePresets)
  return {
    custom,
    presets: [...BUILT_IN_PRESETS, ...custom],
    addPreset: (work: number, pause: number) => setCustom([...custom, createPreset(work, pause)]),
    removePreset: (id: string) => setCustom(custom.filter((preset) => preset.id !== id)),
  }
}
