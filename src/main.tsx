import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/header.css'
import './styles/workspace.css'
import './styles/preview.css'
import './styles/document.css'
import './styles/responsive.css'
import './styles/print.css'
import './styles/editing.css'
import './dark.css'
import './fonts.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
