import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'chem-structura/style.css'
import './page.css'
import App from './App.tsx'

document.title = 'Structura'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
