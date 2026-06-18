import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/reset.css'
import App from './App.tsx'

// Stamp the platform on <html> so CSS can branch per OS (e.g. traffic zone on macOS only).
if (typeof window !== 'undefined' && window.adFrame?.platform) {
  document.documentElement.dataset.platform = window.adFrame.platform;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
