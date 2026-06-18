/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Repo is served from https://krmaeots.github.io/Gymlog/, so production assets
// must resolve under that sub-path. `vite build` runs with command === 'build';
// dev/preview/test use the root base. (Using `command` avoids relying on
// `process`, which isn't typed without @types/node.)
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Gymlog/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'GymLog',
        short_name: 'GymLog',
        description: 'Local-first gym tracker with automatic progressive overload.',
        lang: 'et',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        // start_url / scope are resolved relative to `base` automatically.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell is fully static — precache everything for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
}))
