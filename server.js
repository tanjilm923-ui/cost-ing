/* GIII Costing Website — local server with buyer-wise record folders.
   Run:  node server.js
   Open: http://localhost:8080

   Saves each style's cost record as JSON under:
     Costing Records\<Buyer>\<StyleNo>.json
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RECORDS = path.join(ROOT, 'Costing Records');
const PORT = 8080;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.ms-excel'
};

function safeName(s) {
  return (s || '').toString().trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'Unknown';
}

function readBody(req) {
  return new Promise((res, rej) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch (e) { rej(e); } });
    req.on('error', rej);
  });
}

function listBuyers() {
  if (!fs.existsSync(RECORDS)) return [];
  return fs.readdirSync(RECORDS, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort();
}

function listStyles(buyer) {
  const dir = path.join(RECORDS, safeName(buyer));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ---- API ----
  if (url.pathname === '/api/save' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const styles = Array.isArray(body.styles) ? body.styles : [];
      if (!styles.length) { res.writeHead(400); res.end('No styles'); return; }
      const saved = [];
      styles.forEach(s => {
        const buyer = safeName(s.customer) || 'Unknown Buyer';
        const dir = path.join(RECORDS, buyer);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, safeName(s.styleNo || 'style') + '.json');
        fs.writeFileSync(file, JSON.stringify(s, null, 2));
        saved.push(buyer + '/' + path.basename(file));
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, saved }));
    } catch (e) { res.writeHead(500); res.end(e.message); }
    return;
  }

  if (url.pathname === '/api/state' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      fs.mkdirSync(RECORDS, { recursive: true });
      fs.writeFileSync(path.join(RECORDS, 'state.json'), JSON.stringify(body, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) { res.writeHead(500); res.end(e.message); }
    return;
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const f = path.join(RECORDS, 'state.json');
    if (!fs.existsSync(f)) { res.writeHead(404); res.end('No state'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(f, 'utf8'));
    return;
  }

  if (url.pathname === '/api/save-default' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      fs.writeFileSync(path.join(ROOT, 'costing_data.js'), 'window.COSTING_DATA = ' + JSON.stringify(body.styles, null, 2) + ';\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) { res.writeHead(500); res.end(e.message); }
    return;
  }

  if (url.pathname === '/api/buyers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listBuyers()));
    return;
  }

  if (url.pathname === '/api/styles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listStyles(url.searchParams.get('buyer') || '')));
    return;
  }

  if (url.pathname === '/api/load') {
    const buyer = safeName(url.searchParams.get('buyer') || '');
    const style = url.searchParams.get('style');
    const dir = path.join(RECORDS, buyer);
    if (style) {
      const file = path.join(dir, safeName(style) + '.json');
      if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(file, 'utf8'));
    } else {
      const all = listStyles(buyer).map(st => {
        const file = path.join(dir, st + '.json');
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(all));
    }
    return;
  }

  // ---- static ----
  let fp = url.pathname === '/' ? '/index.html' : url.pathname;
  fp = path.normalize(path.join(ROOT, fp));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Costing Website running at http://localhost:' + PORT);
  console.log('Buyer records folder: ' + RECORDS);
});
