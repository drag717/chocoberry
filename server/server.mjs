import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const dataDir = join(root, 'server', 'data');
const uploadsDir = join(root, 'public', 'uploads');
const port = Number(process.env.PORT || 8080);
const adminPassword = process.env.ADMIN_PASSWORD || 'choco9380';
const tokens = new Set();

const seeds = {
  products: join(root, 'src', 'data', 'products.json'),
  reviews: join(root, 'src', 'data', 'reviews.json'),
  gallery: join(root, 'src', 'data', 'gallery.json'),
  contacts: join(root, 'src', 'data', 'contacts.json'),
};

const files = {
  products: join(dataDir, 'products.json'),
  reviews: join(dataDir, 'reviews.json'),
  gallery: join(dataDir, 'gallery.json'),
  contacts: join(dataDir, 'contacts.json'),
};

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

await mkdir(dataDir, { recursive: true });
await mkdir(uploadsDir, { recursive: true });
await Promise.all(Object.keys(files).map(ensureDataFile));

async function ensureDataFile(key) {
  try {
    await stat(files[key]);
  } catch {
    await writeFile(files[key], await readFile(seeds[key], 'utf8'), 'utf8');
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return tokens.has(token);
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  sendJson(res, 401, { error: 'Unauthorized' });
  return false;
}

function cleanUploadName(name) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'photo.jpg';
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/data') {
    sendJson(res, 200, {
      products: await readJson(files.products),
      reviews: await readJson(files.reviews),
      galleryItems: await readJson(files.gallery),
      contacts: publicContacts(await readJson(files.contacts)),
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await bodyJson(req);
    if (body.password !== adminPassword) {
      sendJson(res, 403, { error: 'Неверный пароль' });
      return true;
    }
    const token = randomUUID();
    tokens.add(token);
    sendJson(res, 200, { token });
    return true;
  }

  const writable = {
    '/api/products': files.products,
    '/api/reviews': files.reviews,
    '/api/gallery': files.gallery,
    '/api/contacts': files.contacts,
  };

  if (req.method === 'PUT' && writable[url.pathname]) {
    if (!requireAuth(req, res)) return true;
    await writeJson(writable[url.pathname], await bodyJson(req));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/upload') {
    if (!requireAuth(req, res)) return true;
    const body = await bodyJson(req);
    if (!body.dataUrl || typeof body.dataUrl !== 'string') {
      sendJson(res, 400, { error: 'dataUrl is required' });
      return true;
    }
    const match = body.dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      sendJson(res, 400, { error: 'Invalid dataUrl' });
      return true;
    }
    const ext = extname(cleanUploadName(body.fileName || 'photo.jpg')) || mimeExt(match[1]);
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const target = join(uploadsDir, fileName);
    await writeFile(target, Buffer.from(match[2], 'base64'));
    sendJson(res, 200, { url: `/uploads/${fileName}` });
    return true;
  }

  return false;
}

function publicContacts(value) {
  const { adminPassword: _adminPassword, ...safe } = value;
  return safe;
}

function mimeExt(mime) {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  return '.jpg';
}

async function staticFile(req, res, url) {
  const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const baseDir = requestPath.startsWith('/uploads/') ? join(root, 'public') : distDir;
  const target = normalize(join(baseDir, requestPath));
  if (!target.startsWith(baseDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    await stat(target);
    res.writeHead(200, { 'content-type': types[extname(target)] || 'application/octet-stream' });
    createReadStream(target).pipe(res);
  } catch {
    const index = join(distDir, 'index.html');
    res.writeHead(200, { 'content-type': types['.html'] });
    createReadStream(index).pipe(res);
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/') && (await api(req, res, url))) return;
    await staticFile(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Server error' });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`ChocoBerry server: http://0.0.0.0:${port}`);
});
