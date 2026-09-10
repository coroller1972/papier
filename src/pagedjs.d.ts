declare module 'pagedjs' {
  export class Previewer {
    preview(content: HTMLElement | DocumentFragment | string, stylesheets: Array<Record<string, string>>, target: HTMLElement): Promise<{ total: number }>
    polisher: { destroy(): void }
    chunker: { destroy(): void; hooks: { beforePageLayout: { register(callback: () => void): void }; afterPageLayout: { register(callback: () => void): void }; renderNode: { register(callback: (clone: Node, source: Node) => void): void } } }
  }
}
