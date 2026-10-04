import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import App from './App'
import { startSync } from './sync'
import { checkSession } from './auth'

startSync()
checkSession()
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')
// warm lazy page chunks (and the offline cache) once the app is idle
setTimeout(() => Object.values(import.meta.glob('./pages/*.tsx')).forEach((load) => load()), 3000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
