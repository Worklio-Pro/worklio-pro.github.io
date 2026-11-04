// Minimal Express-compatible router built on node:http (no dependencies).
// Supports: app.use / get / post / put / delete, :params, '*', json + urlencoded
// body parsing, static files, and res.status/json/send/redirect/sendFile.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { AsyncResource } = require('async_hooks');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.mov': 'video/mp4', '.webm': 'video/webm', // .mov as mp4: browsers that can play it only do so under that type
};
const MAX_BODY = 20 * 1024 * 1024;

function compile(p) {
  if (p === '*') return { re: /^.*$/, keys: [] };
  const keys = [];
  const src = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([A-Za-z_]\w*)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
  return { re: new RegExp('^' + src + '/?$'), keys };
}

// videos stream in pieces: iPhones won't play one without Range requests, and they're too big to read into memory
function serveVideo(file, size, req, res) {
  const ext = path.extname(file).toLowerCase(); res.setHeader('Content-Type', MIME[ext]); res.setHeader('Accept-Ranges', 'bytes');
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''); let start = 0; let end = size - 1;
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(Number(m[2]), end); } else start = Math.max(size - Number(m[2]), 0);
    if (start > end) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${size}`); return res.end(); }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  res.setHeader('Content-Length', end - start + 1);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}
function serveFile(file, res) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end((ext === '.css' || ext === '.html') && module.exports.recolor ? module.exports.recolor(buf, ext) : buf); // Alpha → Settings → Website colors (lib/brand.js)
  });
}

function readBody(req, cb) {
  if (req._bodyRead) return cb(null, req._raw);
  cb = AsyncResource.bind(cb); // run the callback in the caller's async context (which account the request is for)
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(); return; } chunks.push(c); });
  req.on('error', cb);
  req.on('end', () => { req._bodyRead = true; req._raw = Buffer.concat(chunks).toString('utf8'); cb(null, req._raw); });
}

function express() {
  const stack = [];
  const app = (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    try { req.path = decodeURIComponent(u.pathname); } catch (e) { res.statusCode = 400; return res.end('Bad request'); }
    req.query = Object.fromEntries(u.searchParams); req.params = {}; req.body = {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
    res.send = (s) => {
      if (s !== null && typeof s === 'object' && !Buffer.isBuffer(s)) return res.json(s);
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(s);
    };
    res.redirect = (a, b) => { res.statusCode = typeof a === 'number' ? a : 302; res.setHeader('Location', typeof a === 'number' ? b : a); res.end(); };
    res.sendFile = (f) => serveFile(f, res);

    let i = 0;
    const next = (err) => {
      if (err) { console.error(err); if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `Server error${err.code ? ` (${err.code})` : ''}. Details are in the server log.` })); } return; }
      const layer = stack[i++];
      if (!layer) { res.statusCode = 404; return res.end('Not found'); }
      const run = (fn) => { try { Promise.resolve(fn(req, res, next)).catch(next); } catch (e) { next(e); } };
      if (layer.use) {
        const pre = layer.prefix;
        if (pre !== '/' && !(req.path === pre || req.path.startsWith(pre + '/'))) return next();
        req._rel = pre === '/' ? req.path : (req.path.slice(pre.length) || '/');
        return run(layer.fn);
      }
      if (layer.method !== req.method && !(layer.method === 'GET' && req.method === 'HEAD')) return next();
      const m = layer.re.exec(req.path);
      if (!m) return next();
      req.params = {}; layer.keys.forEach((k, n) => { req.params[k] = decodeURIComponent(m[n + 1]); });
      return run(layer.fn);
    };
    next();
  };

  app.use = (a, b) => { if (typeof a === 'function') stack.push({ use: true, prefix: '/', fn: a }); else stack.push({ use: true, prefix: a.replace(/\/+$/, '') || '/', fn: b }); };
  ['get', 'post', 'put', 'delete'].forEach((m) => {
    app[m] = (p, ...fns) => { const c = compile(p); fns.forEach((fn) => stack.push({ method: m.toUpperCase(), re: c.re, keys: c.keys, fn })); };
  });
  app.listen = (port, cb) => http.createServer(app).listen(port, cb);
  return app;
}

express.json = () => (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !/json/i.test(req.headers['content-type'] || '')) return next();
  readBody(req, (err, raw) => {
    if (err) return next(err);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { res.statusCode = 400; return res.end('Invalid JSON'); }
    next();
  });
};
express.urlencoded = () => (req, res, next) => {
  if (req.method !== 'POST' || !/urlencoded/i.test(req.headers['content-type'] || '')) return next();
  readBody(req, (err, raw) => {
    if (err) return next(err);
    req.body = Object.fromEntries(new URLSearchParams(raw));
    next();
  });
};
express.static = (dir) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let rel = req._rel || req.path; if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(dir, rel);
  if (!file.startsWith(dir + path.sep)) return next();
  fs.stat(file, (e, s) => { if (e || !s.isFile()) return next(); if (/\.(mp4|mov|webm)$/i.test(file)) { if (!s.size) { res.statusCode = 404; return res.end('Not found'); } return serveVideo(file, s.size, req, res); } serveFile(file, res); });
};

module.exports = express;
