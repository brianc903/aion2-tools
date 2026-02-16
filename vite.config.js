import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.js'
      },
      preload: {
        input: {
          preload: 'electron/preload.js'
        }
      },
      renderer: {}
    }),
    renderer()
  ]
})
