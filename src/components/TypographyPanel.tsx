import { defaultTypography, fonts, typographyPresets } from '../lib/typography'
import type { FontId, TypographySettings } from '../types'

export function TypographyPanel({ value, onChange }: { value: TypographySettings; onChange: (value: TypographySettings) => void }) {
  const update = <K extends keyof TypographySettings>(key: K, next: TypographySettings[K]) => onChange({ ...value, [key]: next })
  return <details className="typography-panel">
    <summary>Typographie <span>Polices et espacement</span></summary>
    <div className="typography-content">
      <div className="typography-presets" aria-label="Préréglages typographiques">
        {typographyPresets.map(preset => <button key={preset.label} type="button" aria-pressed={Object.keys(value).every(key => value[key as keyof TypographySettings] === preset.settings[key as keyof TypographySettings])} onClick={() => onChange(preset.settings)}>{preset.label}</button>)}
        <button type="button" onClick={() => onChange(defaultTypography)}>Selon le thème</button>
      </div>
      <div className="typography-fields">
        {(['body', 'headings', 'code'] as const).map((role, index) => <label key={role}>
          <span>{['Police du texte', 'Police des titres', 'Police du code'][index]}</span>
          <select aria-label={['Police du texte', 'Police des titres', 'Police du code'][index]} value={value[role]} onChange={event => update(role, event.target.value as FontId)}>
            <option value="theme">{role === 'headings' ? 'Comme le texte' : 'Selon le thème'}</option>
            {['Sans empattement', 'Avec empattements', 'Monospace'].filter(category => role !== 'code' || category === 'Monospace').map(category => <optgroup key={category} label={category}>
              {fonts.filter(font => font.category === category).map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
            </optgroup>)}
          </select>
        </label>)}
        <label><span>Taille du texte</span><select aria-label="Taille du texte" value={value.size ?? ''} onChange={event => update('size', event.target.value ? Number(event.target.value) : null)}>
          <option value="">Selon le thème</option>
          {Array.from({ length: 19 }, (_, index) => 9 + index / 2).map(size => <option key={size} value={size}>{size.toLocaleString('fr-FR')} pt</option>)}
        </select></label>
        <label><span>Interligne</span><select aria-label="Interligne" value={value.lineHeight ?? ''} onChange={event => update('lineHeight', event.target.value ? Number(event.target.value) : null)}>
          <option value="">Selon le thème</option>
          {[1.2, 1.3, 1.4, 1.5, 1.55, 1.6, 1.7, 1.8, 1.9, 2].map(height => <option key={height} value={height}>{height.toLocaleString('fr-FR')}</option>)}
        </select></label>
      </div>
      <p>Les titres suivent la taille du texte. Vos choix sont enregistrés automatiquement.</p>
    </div>
  </details>
}
