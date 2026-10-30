import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Same as the sister concept apps: `dedupe` keeps one React across this app and both packages, and
// `base` is `/<repo-slug>/` for the production BUILD only (graphl.in/linux-admin/); dev stays at `/`
// so the recorder's localhost:5173/#/<slug> is unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/linux-admin/' : '/',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173 },
}))
