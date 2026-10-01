import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-router|scheduler)[\\/]/,
              minSize: 20_000,
              priority: 20
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/]@supabase[\\/]/,
              minSize: 20_000,
              priority: 15
            },
            {
              name: 'vendor',
              test: /node_modules/,
              minSize: 20_000,
              maxSize: 250_000,
              priority: 10
            }
          ]
        }
      }
    }
  }
})
