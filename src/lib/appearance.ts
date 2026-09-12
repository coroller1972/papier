export type Appearance = 'light' | 'dark'
const key = 'papier-appearance-v1'

export function loadAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* The interface remains usable without storage. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveAppearance(value: Appearance) {
  try { localStorage.setItem(key, value) } catch { /* Keep the choice for this visit. */ }
}

// Apply before React mounts to avoid a bright flash when restoring dark mode.
document.documentElement.dataset.appearance = loadAppearance()
