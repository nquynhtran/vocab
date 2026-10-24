// Draws the PNG app icons in public/ from the same "V" as public/favicon.svg.
// iPhone home-screen icons must be PNG, and this keeps them reproducible with Node alone
// (no image library). Run after changing the design: `node scripts/make-icons.mjs`.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// Keep in sync with public/favicon.svg (32×32 viewBox).
const BACKGROUND = [0x42, 0x55, 0xff]
const STROKE = [0xff, 0xff, 0xff]
const STROKE_WIDTH = 3.5
const POINTS = [
  [9, 9],
  [16, 24],
  [23, 9],
]
// The favicon's "V" spans 15 units of 32; home-screen icons get a margin so iOS rounding and
// Android masks never clip it.
const SCALE = 0.8

// Full square, no rounded corners or transparency: iOS and Android round the icon themselves
// and fill transparent pixels with black.
const ICONS = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
]

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** RGB rows, each prefixed with PNG filter byte 0. Round caps and joins come from the distance. */
function render(size) {
  const unit = (size / 32) * SCALE
  const offset = (size - 32 * unit) / 2
  const halfWidthPx = (STROKE_WIDTH / 2) * unit
  const rows = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3)
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5 - offset) / unit
      const py = (y + 0.5 - offset) / unit
      const distancePx =
        Math.min(
          distanceToSegment(px, py, POINTS[0], POINTS[1]),
          distanceToSegment(px, py, POINTS[1], POINTS[2]),
        ) * unit
      // One pixel of anti-aliasing along the edge.
      const coverage = Math.max(0, Math.min(1, halfWidthPx - distancePx + 0.5))
      for (let c = 0; c < 3; c++) {
        rows[rowStart + 1 + x * 3 + c] = Math.round(
          BACKGROUND[c] + (STROKE[c] - BACKGROUND[c]) * coverage,
        )
      }
    }
  }
  return rows
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function png(size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const { file, size } of ICONS) {
  writeFileSync(file, png(size))
  console.log(`wrote ${file} (${size}×${size})`)
}
