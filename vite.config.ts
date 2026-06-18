import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const UPLOADS_DIR = path.join(os.homedir(), 'Documents', 'Screenlet', 'assets')

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'serve-user-uploads',
      configureServer(server) {
        server.middlewares.use('/uploads', (req, res, next) => {
          const filename = path.basename(req.url ?? '')
          const filePath = path.join(UPLOADS_DIR, filename)
          if (filename && fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase()
            res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res as NodeJS.WritableStream)
          } else {
            next()
          }
        })
      },
    },
  ],
})
