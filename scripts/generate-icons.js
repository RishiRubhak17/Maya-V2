import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generatePNG(size, isMaskable = false) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const center = size / 2;
  const radius = size * (isMaskable ? 0.38 : 0.44);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0: None
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Cyberpunk dark background: #090a0f
      let r = 9;
      let g = 10;
      let b = 15;
      let a = 255;

      // Hex/Circle boundary ring
      if (Math.abs(dist - radius) < (size * 0.015)) {
        r = 16; g = 185; b = 129; // emerald
      } else if (dist < radius) {
        // Delta Triangle emblem inside
        // Normalize coordinates inside (-1 to 1)
        const nx = dx / radius;
        const ny = dy / radius;

        // Triangle vertices: (0, -0.65), (0.6, 0.5), (-0.6, 0.5)
        const inTriangle = ny <= 0.55 && (ny >= -0.65 + 1.9 * Math.abs(nx));
        const inInnerTriangle = ny <= 0.45 && ny >= 0.0 && (ny >= -0.1 + 1.2 * Math.abs(nx));

        if (inTriangle && !inInnerTriangle) {
          // Cyber gradient from emerald (#10b981) to cyan (#06b6d4)
          const grad = (ny + 0.65) / 1.2;
          r = Math.floor(16 * (1 - grad) + 6 * grad);
          g = Math.floor(185 * (1 - grad) + 182 * grad);
          b = Math.floor(129 * (1 - grad) + 212 * grad);
        } else if (dist < size * 0.08) {
          // Central luminous core
          r = 56; g = 189; b = 248; // light cyan
        } else {
          // Inner cockpit backdrop
          r = 15; g = 23; b = 42;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePNG(192));
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generatePNG(192));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePNG(180));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePNG(512));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePNG(512, true));

console.log('PWA PNG assets successfully generated in public/ directory.');
