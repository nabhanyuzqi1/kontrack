import { transformSync } from 'esbuild';
import fs from 'node:fs';
const src = fs.readFileSync('src/components/projects/ProjectModal.jsx','utf8').split('\n');
// Uji setiap prefix baris: cari baris pertama yang membuat JSX tidak seimbang.
for (const n of [340, 420, 460, 480, 540, 565, 620, 640, 690, 700]) {
  const body = src.slice(0, n).join('\n') + '\n</div></div></form></Modal>);};\nexport default X;';
  try { transformSync(body, { loader: 'jsx' }); console.log(n, 'OK'); }
  catch (e) { const m = String(e.message).split('\n').slice(0,2).join(' | '); console.log(n, 'GAGAL ->', m); }
}
