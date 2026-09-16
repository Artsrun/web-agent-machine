/* Dependency-free static server for site/. Playwright boots it so the
   suite tests the working tree instead of whatever is on Pages. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../site/', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // normalize() collapses ../ so a request cannot escape site/
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (rel.endsWith('/')) rel += 'index.html';
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => console.log(`site on http://localhost:${PORT}`));
