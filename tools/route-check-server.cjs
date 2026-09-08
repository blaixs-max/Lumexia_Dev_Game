const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const bundleRoot = path.resolve(__dirname, '../../route-check');
const publicRoot = path.resolve(__dirname, '../public');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.mp4': 'audio/mp4' };
const port = Number(process.argv[2] || 5179);
http.createServer((request, response) => {
  let url;
  try { url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400); response.end(); return; }
  if (url === '/') url = '/tools/route-check.html';
  const root = /^\/(models|textures|draco|audio)\//.test(url) ? publicRoot : bundleRoot;
  const target = path.resolve(root, '.' + url);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Route QA: http://127.0.0.1:${port}`));
