import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'public', 'landing-page');

// name -> max width on screen (retina-padded). Height auto (keeps aspect).
const targets = {
  'rectangle-415': 900,
  'rectangle-416': 900,
  'rectangle-417': 900,
  'rectangle-418': 900,
  'rectangle-27': 1600,
  'rectangle-31': 1920,
};

const extractBase64 = (svg) => {
  const m = svg.match(/data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error('no embedded raster found');
  return Buffer.from(m[2], 'base64');
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

for (const [name, maxW] of Object.entries(targets)) {
  const svgPath = join(dir, `${name}.svg`);
  const outPath = join(dir, `${name}.webp`);
  const before = statSync(svgPath).size;

  const raster = extractBase64(readFileSync(svgPath, 'utf8'));
  const img = sharp(raster, { failOn: 'none' });
  const meta = await img.metadata();
  const resizeW = Math.min(maxW, meta.width || maxW);

  await img
    .resize({ width: resizeW, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(outPath);

  const after = statSync(outPath).size;
  console.log(
    `${name}: ${meta.width}x${meta.height} ${kb(before)} svg -> ${resizeW}px ${kb(after)} webp  (${(100 - (after / before) * 100).toFixed(1)}% smaller)`
  );
}
