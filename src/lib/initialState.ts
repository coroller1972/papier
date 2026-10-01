import { SAMPLE_MARKDOWN } from '../data/sample'
import { defaultTypography, restoreSettings } from './typography'
import type { DocumentSettings } from '../types'

const STORAGE_KEY = 'papier-document-v1'
const SETTINGS_KEY = 'papier-settings-v1'

export const DEFAULT_SETTINGS: DocumentSettings = {
  typography: defaultTypography,
  format: 'A4',
  margins: 'normal',
  theme: 'editorial',
  zoom: 80,
}

export function loadStoredDocument() {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE_MARKDOWN } catch { return SAMPLE_MARKDOWN }
}

export function loadStoredSettings(): DocumentSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY)
    return stored ? restoreSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}
