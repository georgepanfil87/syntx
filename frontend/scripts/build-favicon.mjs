
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SVG_PATH = join(ROOT, 'public', 'favicon.svg');
const ICO_PATH = join(ROOT, 'public', 'favicon.ico');

const SIZES = [16, 32, 48];

async function main() {
  const svg = await readFile(SVG_PATH);
  const pngs = await Promise.all(
    SIZES.map((size) =>
      sharp(svg).resize(size, size).png().toBuffer().then((buf) => ({ size, buf })),
    ),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  const blobs = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // colour palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    blobs.push(buf);
    offset += buf.length;
  }

  const ico = Buffer.concat([header, ...entries, ...blobs]);
  await writeFile(ICO_PATH, ico);
  console.log(`Wrote ${ICO_PATH} (${ico.length} bytes, sizes: ${SIZES.join(',')})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
