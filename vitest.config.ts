import { defineConfig } from 'vitest/config';

// Tests cover pure game/audio logic, so they run in plain Node without the
// React/Tailwind build plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
