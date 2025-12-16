import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // IMPORTANT for Electron/file:// builds:
  // Use relative asset paths so /assets/... doesn't resolve to file:///assets/...
  base: './',
  plugins: [react()],
})
