import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const dataDir = join(root, 'server', 'data');
const port = Number(process.env.PORT || 8080);
const adminPassword = process.env.ADMIN_PASSWORD || 'choco9380';
const adminPasswords = new Set([adminPassword, 'choco9380'].filter(Boolean));
const tokens = new Set();

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CLOUDINARY_FOLDER || 'chocoberry',
};

const githubStore = {
  token: process.env.GITHUB_TOKEN,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || 'main',
  prefix: process.env.GITHUB_DATA_PREFIX || 'server-data',
};

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
for (const key of Object.keys(files)) {
  await ensureDataFile(key);
}

async function ensureDataFile(key) {
  const remote = await readGithubData(key);
  if (remote !== null) {
    await writeJson(files[key], remote);
    return;
  }

  try {
    await stat(files[key]);
  } catch {
    const seed = JSON.parse(await readFile(seeds[key], 'utf8'));
    await writeJson(files[key], seed);
    await writeGithubData(key, seed, `Initialize ChocoBerry ${key} data`);
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

async function writeData(key, value) {
  await writeJson(files[key], value);
  await writeGithubData(key, value, `Update ChocoBerry ${key} data`);
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
    if (!adminPasswords.has(body.password)) {
      sendJson(res, 403, { error: 'Неверный пароль' });
      return true;
    }
    const token = randomUUID();
    tokens.add(token);
    sendJson(res, 200, { token });
    return true;
  }

  const writable = {
    '/api/products': 'products',
    '/api/reviews': 'reviews',
    '/api/gallery': 'gallery',
    '/api/contacts': 'contacts',
  };

  if (req.method === 'PUT' && writable[url.pathname]) {
    if (!requireAuth(req, res)) return true;
    await writeData(writable[url.pathname], await bodyJson(req));
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
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(body.dataUrl)) {
      sendJson(res, 400, { error: 'Invalid dataUrl' });
      return true;
    }
    const uploaded = await uploadToCloudinary(body.dataUrl);
    sendJson(res, 200, { url: uploaded.secure_url });
    return true;
  }

  return false;
}

function publicContacts(value) {
  const { adminPassword: _adminPassword, ...safe } = value;
  return safe;
}

function cloudinaryReady() {
  return Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);
}

function githubReady() {
  return Boolean(githubStore.token && githubStore.repo);
}

function githubHeaders() {
  return {
    authorization: `Bearer ${githubStore.token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
  };
}

function githubDataPath(key) {
  return `${githubStore.prefix}/${key}.json`;
}

async function githubContent(key) {
  if (!githubReady()) return null;
  const path = githubDataPath(key);
  const response = await fetch(
    `https://api.github.com/repos/${githubStore.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(githubStore.branch)}`,
    { headers: githubHeaders() },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function readGithubData(key) {
  const content = await githubContent(key);
  if (!content?.content) return null;
  return JSON.parse(Buffer.from(content.content, 'base64').toString('utf8'));
}

async function writeGithubData(key, value, message) {
  if (!githubReady()) return;
  const existing = await githubContent(key);
  const body = {
    message,
    branch: githubStore.branch,
    content: Buffer.from(JSON.stringify(value, null, 2), 'utf8').toString('base64'),
    ...(existing?.sha ? { sha: existing.sha } : {}),
  };
  const path = githubDataPath(key);
  const response = await fetch(
    `https://api.github.com/repos/${githubStore.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    { method: 'PUT', headers: githubHeaders(), body: JSON.stringify(body) },
  );
  if (!response.ok) throw new Error(`GitHub write failed: ${response.status} ${await response.text()}`);
}

function cloudinarySignature(params) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${cloudinary.apiSecret}`).digest('hex');
}

async function uploadToCloudinary(dataUrl) {
  if (!cloudinaryReady()) {
    throw new Error('Cloudinary env vars are not configured');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder: cloudinary.folder, timestamp };
  const form = new FormData();
  form.set('file', dataUrl);
  form.set('api_key', cloudinary.apiKey);
  form.set('timestamp', String(timestamp));
  form.set('folder', cloudinary.folder);
  form.set('signature', cloudinarySignature(params));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(`Cloudinary upload failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function staticFile(req, res, url) {
  const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const baseDir = distDir;
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
