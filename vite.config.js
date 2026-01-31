import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-static-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Serve entity-placer.html directly from public folder
          if (req.url === '/entity-placer.html' || req.url === '/entity-placer') {
            const filePath = path.join(process.cwd(), 'public', 'entity-placer.html')
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'text/html')
              res.end(fs.readFileSync(filePath, 'utf-8'))
              return
            }
          }
          next()
        })
      }
    }
  ],
  server: {
    proxy: {
      '/ha-api': {
        target: 'https://tmlwyyay4lifcnyxgsu3fas9fk8umlcu.ui.nabu.casa',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ha-api/, '/api'),
        secure: true,
      },
    },
  },
})
