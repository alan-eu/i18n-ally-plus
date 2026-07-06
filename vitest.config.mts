import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    // the source reads process.env.I18N_ALLY_ENV to enter test mode
    env: {
      I18N_ALLY_ENV: 'test',
    },
  },
  resolve: {
    // mirror the tsconfig `~/* -> src/*` path alias so source modules resolve
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
