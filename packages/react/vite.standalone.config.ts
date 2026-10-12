// The editor for pages without React: src/standalone.tsx with React and everything else bundled
// in, as an ES module (dist/standalone.js, RDKit's loader a separate chunk fetched on first use)
// and for a plain <script> (dist/chem-structura.iife.js, setting window.ChemStructura). Runs
// after vite.config.ts, whose style.css both use; see that file.
import react from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["structura-source", ...defaultClientConditions] },
  // Library builds leave process.env alone; React picks its production build from it.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/standalone.tsx",
      name: "ChemStructura",
      formats: ["es", "iife"],
      fileName: (format) => (format === "es" ? "standalone.js" : "chem-structura.iife.js"),
    },
    rolldownOptions: {
      output: { chunkFileNames: "chunks/[name]-[hash].js" },
    },
  },
})
