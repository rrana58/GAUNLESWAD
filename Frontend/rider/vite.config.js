import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const isNative = mode === 'native' || process.env.VITE_BUILD_TARGET === 'native';
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    base: isNative ? '/' : '/rider/',
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
    },
    server: {
      port: 5176
    }
  }
})
