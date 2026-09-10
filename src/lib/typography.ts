import type { DocumentSettings, FontId, TypographySettings } from '../types'

export const fonts: { value: FontId; label: string; family: string; category: string }[] = [
  { value: 'inter', label: 'Inter', family: 'Inter Variable', category: 'Sans empattement' },
  { value: 'source-sans-3', label: 'Source Sans 3', family: 'Source Sans 3 Variable', category: 'Sans empattement' },
  { value: 'nunito-sans', label: 'Nunito Sans', family: 'Nunito Sans Variable', category: 'Sans empattement' },
  { value: 'source-serif-4', label: 'Source Serif 4', family: 'Source Serif 4 Variable', category: 'Avec empattements' },
  { value: 'literata', label: 'Literata', family: 'Literata Variable', category: 'Avec empattements' },
  { value: 'lora', label: 'Lora', family: 'Lora Variable', category: 'Avec empattements' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', family: 'JetBrains Mono Variable', category: 'Monospace' },
  { value: 'roboto-mono', label: 'Roboto Mono', family: 'Roboto Mono Variable', category: 'Monospace' },
]
export const defaultTypography: TypographySettings = { body: 'theme', headings: 'theme', code: 'theme', size: null, lineHeight: null }
export const typographyPresets: { label: string; settings: TypographySettings }[] = [
  { label: 'Rapport', settings: { body: 'source-sans-3', headings: 'inter', code: 'jetbrains-mono', size: 11, lineHeight: 1.55 } },
  { label: 'Lecture', settings: { body: 'literata', headings: 'lora', code: 'roboto-mono', size: 12, lineHeight: 1.7 } },
  { label: 'Documentation', settings: { body: 'inter', headings: 'source-sans-3', code: 'jetbrains-mono', size: 10.5, lineHeight: 1.6 } },
]

export function normalizeTypography(value?: Partial<TypographySettings> | null): TypographySettings {
  const font = (id?: FontId): FontId => fonts.some(font => font.value === id) ? id! : 'theme'
  const number = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null
  return { body: font(value?.body), headings: font(value?.headings), code: font(value?.code), size: number(value?.size, 9, 18), lineHeight: number(value?.lineHeight, 1.2, 2) }
}

export function applyTypography(source: HTMLElement, typography: TypographySettings) {
  for (const role of ['body', 'headings', 'code'] as const) {
    const font = fonts.find(font => font.value === typography[role])
    if (font) source.style.setProperty(`--paper-${role}-font`, `"${font.family}"`)
  }
  if (typography.size !== null) {
    source.style.setProperty('--paper-size', `${typography.size}pt`)
    for (const [index, ratio] of [29 / 15, 20 / 15, 17 / 15].entries()) {
      source.style.setProperty(`--paper-h${index + 1}-size`, `${typography.size * ratio}pt`)
    }
  }
  if (typography.lineHeight !== null) source.style.setProperty('--paper-line-height', String(typography.lineHeight))
}

// Explicitly load every selected weight/style before pagination, including accents.
async function loadSelectedFonts(typography: TypographySettings) {
  const families = new Set([typography.body, typography.headings, typography.code])
  await Promise.all([...families].flatMap(id => {
    const font = fonts.find(font => font.value === id)
    if (!font) return []
    return ['400', '650', '700', 'italic 400', 'italic 650', 'italic 700'].map(async style => {
      const faces = await document.fonts.load(`${style} 16px "${font.family}"`, 'Papier éèàçœ Ā')
      if (!faces.length) throw new Error(`Police indisponible : ${font.label}`)
    })
  }))
  await document.fonts.ready
}

export function restoreSettings(settings: DocumentSettings): DocumentSettings {
  return { ...settings, typography: normalizeTypography(settings.typography) }
}

export async function loadTypography(typography: TypographySettings) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      loadSelectedFonts(typography),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Chargement des polices trop long')), 15000) }),
    ])
  } finally { clearTimeout(timer) }
}
