import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/reset.css'
import App from './App.tsx'

// Stamp the platform on <html> so CSS can branch per OS (e.g. traffic zone on macOS only).
if (typeof window !== 'undefined' && window.adFrame?.platform) {
  document.documentElement.dataset.platform = window.adFrame.platform;
  // On Windows, set a fallback CSS var for the native window controls width (~138px on Win11).
  // The env(titlebar-area-width) variable from Electron's titleBarOverlay takes precedence in
  // the actual rule, but this guarantees the header shifts on the very first render.
  if (window.adFrame.platform === 'win32') {
    document.documentElement.style.setProperty('--win-controls-w', '152px');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
