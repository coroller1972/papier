export type PageFormat = 'A4' | 'Letter'
export type MarginSize = 'compact' | 'normal' | 'wide'
export type DocumentTheme = 'editorial' | 'modern' | 'minimal'
export type PreviewStatus = 'rendering' | 'ready' | 'error'

export type FontId = 'theme' | 'inter' | 'source-sans-3' | 'nunito-sans' | 'source-serif-4' | 'literata' | 'lora' | 'jetbrains-mono' | 'roboto-mono'
export interface TypographySettings {
  body: FontId
  headings: FontId
  code: FontId
  size: number | null
  lineHeight: number | null
}

export interface DocumentSettings {
  typography: TypographySettings
  format: PageFormat
  margins: MarginSize
  theme: DocumentTheme
  zoom: number
}

export interface WorkspaceDocument {
  path: string
  name: string
  content: string
  originalContent?: string
}
