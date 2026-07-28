import { defineConfig } from 'vitest/config'

// The web package's only unit tests are the pure reward math in src/lib.
// Everything else is verified in a real browser (see README > Testing).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
