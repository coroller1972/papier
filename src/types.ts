export type PageFormat = 'A4' | 'Letter'
export type MarginSize = 'compact' | 'normal' | 'wide'
export type DocumentTheme = 'editorial' | 'modern' | 'minimal'
export type PreviewStatus = 'rendering' | 'ready' | 'error'

export interface DocumentSettings {
  format: PageFormat
  margins: MarginSize
  theme: DocumentTheme
  zoom: number
}

export interface WorkspaceDocument {
  path: string
  name: string
  content: string
}
