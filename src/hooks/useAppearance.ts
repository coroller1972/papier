import { useState } from 'react'
import { loadAppearance, saveAppearance } from '../lib/appearance'

export function useAppearance() {
  const [appearance, setAppearance] = useState(loadAppearance)
  const toggleAppearance = () => {
    const next = appearance === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.appearance = next
    saveAppearance(next)
    setAppearance(next)
  }
  return { appearance, toggleAppearance }
}
