import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '../dist/assets');
const srcRoot = path.join(__dirname, '..');
const restored = [];

for (const file of fs.readdirSync(dist)) {
  if (!file.endsWith('.map')) continue;
  const map = JSON.parse(fs.readFileSync(path.join(dist, file), 'utf8'));
  if (!map.sourcesContent) continue;
  map.sources.forEach((src, i) => {
    const content = map.sourcesContent[i];
    if (!content) return;
    const rel = src.replace(/^\.\.\/\.\.\//, '');
    const full = path.join(srcRoot, rel);
    const stat = fs.existsSync(full) ? fs.statSync(full) : null;
    if (!stat || stat.size === 0) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
      restored.push(rel);
    }
  });
}

console.log(`restored from maps: ${restored.length}`);
restored.forEach((r) => console.log(r));
