import { defineConfig } from 'vite'

export default defineConfig({
  // Needed for Electron loadFile(file://...) so assets resolve correctly.
  base: './'
})
