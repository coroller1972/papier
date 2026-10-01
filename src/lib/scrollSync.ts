// Lightweight pub/sub linking editor and preview scroll positions by (fractional) source line.
// A pub/sub avoids re-rendering the app on every scroll event.
export type ScrollOrigin = 'editor' | 'preview'
type Listener = (origin: ScrollOrigin, line: number) => void

const STORAGE_KEY = 'papier-scroll-sync'
const listeners = new Set<Listener>()
let enabled = true
try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off' } catch { /* Storage can be unavailable. */ }

export const isScrollSyncEnabled = () => enabled
export function setScrollSyncEnabled(value: boolean) {
  enabled = value
  try { localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off') } catch { /* Keep the in-memory choice. */ }
}

export function publishScroll(origin: ScrollOrigin, line: number) {
  if (enabled) listeners.forEach(listener => listener(origin, line))
}

export function subscribeScroll(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// Scroll events caused by our own programmatic scrolling must not echo back.
export function createEchoGuard() {
  let expected = Number.NaN
  return {
    expect(position: number) { expected = position },
    isEcho(position: number) {
      if (Math.abs(position - expected) < 2) return true
      expected = Number.NaN
      return false
    },
  }
}
