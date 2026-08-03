import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Customer-facing PWA — also gets wrapped with Capacitor in Phase 10
// for real iOS / Android store builds.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gaunle Swad',
        short_name: 'Gaunle Swad',
        description: 'Order home-style Nepali meals, subscriptions, and thalis for delivery.',
        theme_color: '#7A1F2B',
        background_color: '#F6F1E7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        navigateFallbackDenylist: [/^\/admin/, /^\/kitchen/, /^\/rider/, /^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/menu'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'menu-cache', expiration: { maxEntries: 100, maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
      sonner: path.resolve(__dirname, './node_modules/sonner'),
      'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    host: true, // expose on LAN so you can test on a real phone during dev
    port: 5173,
  },
})