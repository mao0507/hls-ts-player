// 維護最近兩段的 playlist，讓 hls.js 可以預載下一段
let segments = []   // [{ url, duration, seq }]
let baseSeq  = 0

function buildPlaylist() {
  const targetDur = segments.length
    ? Math.max(...segments.map(s => s.duration))
    : 6
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${Math.ceil(targetDur)}`,
    `#EXT-X-MEDIA-SEQUENCE:${baseSeq}`,
  ]
  segments.forEach((s, i) => {
    if (i > 0) {
      lines.push('#EXT-X-DISCONTINUITY')
      lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${s.seq}`)
    }
    lines.push(`#EXTINF:${Number(s.duration).toFixed(3)},`)
    lines.push(s.url)
  })
  return lines.join('\n') + '\n'
}

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('fetch', event => {
  if (new URL(event.request.url).pathname === '/_hls_fake_.m3u8') {
    event.respondWith(new Response(buildPlaylist(), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store'
      }
    }))
  }
})

self.addEventListener('message', event => {
  const { type } = event.data

  if (type === 'APPEND_SEGMENT') {
    // 加入新的片段，最多保留 6 段
    const { url, duration, seq } = event.data
    segments.push({ url, duration, seq })
    if (segments.length > 10) {
      baseSeq = segments[segments.length - 10].seq
      segments = segments.slice(-10)
    }
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: 'OK' })
    }
  }

  if (type === 'RESET') {
    segments = []
    baseSeq  = 0
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: 'OK' })
    }
  }
})
