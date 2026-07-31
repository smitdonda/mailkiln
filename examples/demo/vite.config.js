import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const r = (p) => fileURLToPath(new URL(p, import.meta.url))

// The playground consumes mailforge straight from source so edits hot-reload.
// It has no package.json of its own on purpose: it runs off the root install
// (`npm run dev`), so the repo needs exactly one `npm install`.
export default defineConfig({
  root: r('.'),
  // The Tailwind plugin is what teaches Vite about `@theme`, `@source` and
  // `prefix(mf)`. Without it the playground silently serves a stylesheet whose
  // Tailwind directives failed to parse — so `npm run dev` doubles as a check on
  // the real CSS pipeline.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'mailforge/style.css': r('../../src/styles.css'),
      'mailforge/core': r('../../src/core/index.js'),
      mailforge: r('../../src/index.js'),
      // one React copy — the root install and the demo install both have one
      react: r('../../node_modules/react'),
      'react-dom': r('../../node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5180, open: false },
})
