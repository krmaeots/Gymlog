// Generates GymLog PWA icons (PNG) and favicon without any image dependency.
// A tiny hand-rolled PNG encoder (Node `zlib` for the DEFLATE stream) draws a
// dumbbell glyph in the brand accent on the dark background.
//
// Run: npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const BG = [13, 13, 13, 255] // #0d0d0d
const ACCENT = [232, 197, 71, 255] // #e8c547

// ── PNG encoder ──────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0
  // Add filter byte (0) at the start of each scanline.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ── drawing ──────────────────────────────────────────────────────────
function makeIcon(size, glyphScale) {
  const buf = Buffer.alloc(size * size * 4)
  // fill background
  for (let i = 0; i < size * size; i++) buf.set(BG, i * 4)

  const fillRect = (x0, y0, x1, y1, color) => {
    const xa = Math.max(0, Math.round(x0))
    const xb = Math.min(size, Math.round(x1))
    const ya = Math.max(0, Math.round(y0))
    const yb = Math.min(size, Math.round(y1))
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) buf.set(color, (y * size + x) * 4)
    }
  }

  // Dumbbell centered, sized to glyphScale of the canvas.
  const s = size
  const cy = s / 2
  const g = glyphScale // fraction of width the whole glyph spans
  const left = s * (0.5 - g / 2)
  const right = s * (0.5 + g / 2)
  const barH = s * 0.09
  const plateW = s * g * 0.12
  const innerPlateH = s * g * 0.42
  const outerPlateH = s * g * 0.62

  // bar
  fillRect(left, cy - barH / 2, right, cy + barH / 2, ACCENT)
  // left plates
  fillRect(left, cy - outerPlateH / 2, left + plateW, cy + outerPlateH / 2, ACCENT)
  fillRect(left + plateW * 1.6, cy - innerPlateH / 2, left + plateW * 2.6, cy + innerPlateH / 2, ACCENT)
  // right plates
  fillRect(right - plateW, cy - outerPlateH / 2, right, cy + outerPlateH / 2, ACCENT)
  fillRect(right - plateW * 2.6, cy - innerPlateH / 2, right - plateW * 1.6, cy + innerPlateH / 2, ACCENT)

  return encodePng(s, s, buf)
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.7 },
  { file: 'icon-512.png', size: 512, scale: 0.7 },
  { file: 'icon-512-maskable.png', size: 512, scale: 0.52 }, // shrink for safe zone
  { file: 'apple-touch-icon.png', size: 180, scale: 0.7 },
]

for (const t of targets) {
  writeFileSync(join(OUT, t.file), makeIcon(t.size, t.scale))
  console.log('wrote', t.file)
}

// Vector favicon (crisp at any size).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0d0d0d"/>
  <g fill="#e8c547">
    <rect x="9" y="14.5" width="14" height="3"/>
    <rect x="6.5" y="11" width="2.5" height="10" rx="1"/>
    <rect x="9.5" y="12.5" width="2" height="7" rx="1"/>
    <rect x="23" y="11" width="2.5" height="10" rx="1"/>
    <rect x="20.5" y="12.5" width="2" height="7" rx="1"/>
  </g>
</svg>
`
writeFileSync(join(ROOT, 'public', 'favicon.svg'), favicon)
console.log('wrote favicon.svg')
