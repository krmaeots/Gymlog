import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Roboto (bundled + precached) — works offline, no font CDN.
// Only the Latin + Latin-Extended subsets (covers Estonian š ž õ ä ö ü) to keep
// the offline precache small.
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import '@fontsource/roboto/latin-900.css'
import '@fontsource/roboto/latin-ext-400.css'
import '@fontsource/roboto/latin-ext-500.css'
import '@fontsource/roboto/latin-ext-700.css'
import '@fontsource/roboto/latin-ext-900.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
