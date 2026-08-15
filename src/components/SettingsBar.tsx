import type { DocumentSettings, DocumentTheme, MarginSize, PageFormat } from '../types'
import { CheckIcon, ChevronDownIcon, ExpandIcon, ZoomInIcon, ZoomOutIcon } from './Icons'

interface SettingsBarProps {
  settings: DocumentSettings
  isFullscreen: boolean
  onChange: (settings: DocumentSettings) => void
  onToggleFullscreen: () => void
}

interface SelectControlProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

function SelectControl<T extends string>({ label, value, options, onChange }: SelectControlProps<T>) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDownIcon width={14} height={14} />
      </span>
    </label>
  )
}

export function SettingsBar({ settings, isFullscreen, onChange, onToggleFullscreen }: SettingsBarProps) {
  const update = <K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="settings-bar">
      <div className="privacy-note"><CheckIcon /> Tout reste dans votre navigateur</div>
      <div className="settings-group">
        <SelectControl<PageFormat>
          label="Format"
          value={settings.format}
          options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'US Letter' }]}
          onChange={(value) => update('format', value)}
        />
        <SelectControl<MarginSize>
          label="Marges"
          value={settings.margins}
          options={[
            { value: 'compact', label: 'Compactes' },
            { value: 'normal', label: 'Normales' },
            { value: 'wide', label: 'Larges' },
          ]}
          onChange={(value) => update('margins', value)}
        />
        <SelectControl<DocumentTheme>
          label="Thème"
          value={settings.theme}
          options={[
            { value: 'editorial', label: 'Éditorial' },
            { value: 'modern', label: 'Moderne' },
            { value: 'minimal', label: 'Minimal' },
          ]}
          onChange={(value) => update('theme', value)}
        />
        <div className="zoom-control">
          <span>Zoom</span>
          <div>
            <button
              type="button"
              aria-label="Réduire le zoom"
              onClick={() => update('zoom', Math.max(50, settings.zoom - 10))}
            ><ZoomOutIcon /></button>
            <output>{settings.zoom} %</output>
            <button
              type="button"
              aria-label="Augmenter le zoom"
              onClick={() => update('zoom', Math.min(130, settings.zoom + 10))}
            ><ZoomInIcon /></button>
          </div>
        </div>
        <button
          className="icon-button fullscreen-button"
          type="button"
          aria-label={isFullscreen ? 'Quitter le plein écran' : 'Agrandir l’aperçu'}
          aria-pressed={isFullscreen}
          onClick={onToggleFullscreen}
        ><ExpandIcon /></button>
      </div>
    </div>
  )
}
