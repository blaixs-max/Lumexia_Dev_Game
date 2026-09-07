const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const variant = process.argv[2] === 'before' ? 'before' : 'after';
const port = Number(process.argv[3] || (variant === 'before' ? 5176 : 5177));
const bundle = path.resolve(__dirname, '../../performance-' + variant);
const publicRoot = path.resolve(__dirname, '../public');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.mp4': 'audio/mp4' };
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (url === '/') url = '/tools/performance-benchmark.html';
  const root = /^\/(models|textures|draco|audio)\//.test(url) ? publicRoot : bundle;
  const target = path.resolve(root, '.' + url);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Render benchmark (${variant}): http://127.0.0.1:${port}`));
