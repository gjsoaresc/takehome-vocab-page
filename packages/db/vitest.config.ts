import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test files share one vocab_test database; run them sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
