const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT = 3000
const ROOT = __dirname

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.ts':   'video/mp2t',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
}

const server = http.createServer((req, res) => {
  // 只允許 GET / HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end(); return
  }

  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'

  // SW 尚未攔截時的 fallback，避免回 404 HTML 造成 manifestParsingError
  if (urlPath === '/_hls_fake_.m3u8') {
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store',
      'Service-Worker-Allowed': '/',
    })
    res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n')
    return
  }

  const filePath = path.join(ROOT, urlPath)

  // 防止目錄跳脫
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end(); return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }

    const ext  = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': 'no-cache',
      // Service Worker 需要這個 header
      'Service-Worker-Allowed': '/',
    })
    if (req.method === 'HEAD') { res.end(); return }
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  ✓ HLS Player 已啟動')
  console.log('')
  console.log(`  → 請在瀏覽器開啟：http://localhost:${PORT}`)
  console.log('')
  console.log('  按 Ctrl+C 停止')
  console.log('')
})
