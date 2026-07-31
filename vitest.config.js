import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node by default — booting jsdom costs ~35s and only the React tests need
    // it, so those opt in with `// @vitest-environment jsdom`. The importer tests
    // run on linkedom here, which also exercises the injected-parser path that
    // Node consumers actually use.
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/core/types.js', 'src/**/index.js'],
    },
  },
})
