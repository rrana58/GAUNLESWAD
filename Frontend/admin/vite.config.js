import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pwaPlugin = VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
  manifest: {
    name: 'Gaunle Swad - Admin Dashboard',
    short_name: 'Admin',
    description: 'Admin Dashboard for Gaunle Swad Cloud Kitchen',
    theme_color: '#7c3aed',
    background_color: '#f1f5f9',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      }
    ]
  },
  workbox: {
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/kitchen/, /^\/rider/, /^\/api/, /^\/$(?!admin)/]
  }
})

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Only enable PWA during production build — avoids service worker
    // caching issues and redirect loops during local development
    ...(command === 'build' ? [pwaPlugin] : []),
  ],
  base: '/',
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
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5174,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/admin') {
          res.statusCode = 301
          res.setHeader('Location', '/admin/')
          res.end()
          return
        }
        next()
      })
    },
  },
}))
