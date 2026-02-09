import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => ({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      'next/navigation': path.resolve(
        import.meta.dirname,
        'app/lib/mocks/next-navigation.ts',
      ),
    },
  },
  ssr: {
    noExternal: ['nextstepjs'],
  },
  build: {
    // Increase chunk size limit (prompt-detail includes heavy deps like syntax highlighter)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress sourcemap warnings from third-party libraries that don't ship complete sourcemaps
        // This is a known Vite 5 / Rollup 4 issue: https://github.com/vitejs/vite/issues/15012
        if (warning.code === 'SOURCEMAP_BROKEN') {
          return;
        }
        // Suppress empty chunk warnings (expected for action-only API routes)
        if (warning.code === 'EMPTY_BUNDLE') {
          return;
        }
        warn(warning);
      },
    },
  },
}));
