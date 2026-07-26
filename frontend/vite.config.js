import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, forward API calls to the Express backend
    // (the production build is served directly by the backend, so this
    // proxy is only needed for local frontend development).
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.io connects on this path by default — needs its own proxy
      // entry (with ws: true) so live updates also work in `npm run dev`.
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
