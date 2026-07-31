import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build. Two entries:
//   index      -> the React editor (public barrel)
//   core/index -> the React-free headless core (renderers, importer, linter)
// Declaration files are emitted separately by `npm run build:types` (tsc reading
// our JSDoc) and the stylesheet by `npm run build:css` (tailwind cli).
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: false, // a library should ship readable code; consumers minify
    lib: {
      entry: {
        index: 'src/index.js',
        'core/index': 'src/core/index.js',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => (format === 'es' ? `${name}.js` : `${name}.cjs`),
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-dom/client',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        'linkedom',
      ],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
