// Local, read-only viewer for the original roadside asset library.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const port = Number(process.env.ASSET_STUDIO_PORT || 5174);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid ASSET_STUDIO_PORT');
http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let target, allowedRoot;
    if (pathname === '/') {
      target = path.join(__dirname, 'asset-studio.html');
      allowedRoot = __dirname;
    } else {
      const mappings = [
        ['/textures/', path.join(repo, 'public', 'textures')],
        ['/src/environment/', path.join(repo, 'src', 'environment')],
        ['/node_modules/three/', path.join(repo, 'node_modules', 'three')],
      ];
      const mapping = mappings.find(([prefix]) => pathname.startsWith(prefix));
      if (!mapping) { response.writeHead(404); response.end('Not found'); return; }
      allowedRoot = mapping[1];
      target = path.resolve(allowedRoot, pathname.slice(mapping[0].length));
    }
    if (!path.resolve(target).startsWith(path.resolve(allowedRoot) + path.sep)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.readFile(target, (error, data) => {
      if (error) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(data);
    });
  } catch { response.writeHead(400); response.end('Bad request'); }
}).listen(port, '127.0.0.1', () => process.stdout.write('Asset studio: http://127.0.0.1:' + port + '/\n'));
