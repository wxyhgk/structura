import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import 'chem-structura/style.css'
import './page.css'
import MarkushApp from './MarkushApp.tsx'
import rdkitWasm from '@rdkit/rdkit/RDKit_minimal.wasm?url'
import { configureRDKit } from 'chem-structura'

// The standalone app serves RDKit's WebAssembly from its own build, not the CDN.
configureRDKit({ wasmUrl: rdkitWasm })

document.title = 'Structura · 通式'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MarkushApp />
  </StrictMode>,
)
