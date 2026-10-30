const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;
const WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 60));
const MAX_BODY_BYTES = 16 * 1024;
const buckets = new Map();
const applications = [];
const internships = [
  { id: 'int-101', title: 'Frontend Engineering Intern', company: 'Northstar Labs', location: 'Remote', type: 'Engineering', postedAt: '2026-10-27', description: 'Build accessible interfaces with a supportive product team.', skills: ['JavaScript', 'HTML', 'CSS'] },
  { id: 'int-102', title: 'Data Analytics Intern', company: 'Cedar Analytics', location: 'Bengaluru, India', type: 'Data', postedAt: '2026-10-25', description: 'Turn real product questions into clear, useful insights.', skills: ['SQL', 'Python', 'Communication'] },
  { id: 'int-103', title: 'Product Design Intern', company: 'Common Ground', location: 'Hybrid · Mumbai, India', type: 'Design', postedAt: '2026-10-23', description: 'Help research and prototype simple, human-centered workflows.', skills: ['Figma', 'Research', 'Prototyping'] },
  { id: 'int-104', title: 'Backend Engineering Intern', company: 'Riverbank Systems', location: 'Remote', type: 'Engineering', postedAt: '2026-10-21', description: 'Learn to build reliable APIs alongside experienced engineers.', skills: ['Node.js', 'HTTP', 'Testing'] },
  { id: 'int-105', title: 'Community & Marketing Intern', company: 'Good Monday', location: 'Hybrid · Delhi, India', type: 'Marketing', postedAt: '2026-10-19', description: 'Create useful stories and events for an early-career community.', skills: ['Writing', 'Social media', 'Planning'] },
  { id: 'int-106', title: 'Operations Intern', company: 'Open Door Studio', location: 'Pune, India', type: 'Operations', postedAt: '2026-10-17', description: 'Make everyday processes clearer and easier for a growing team.', skills: ['Organization', 'Spreadsheets', 'Problem solving'] }
];
const types = new Set(['Engineering', 'Data', 'Design', 'Marketing', 'Operations']);

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
}
function sendJson(res, status, payload, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(payload));
}
function consumeRateLimit(req, res) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'unknown';
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + WINDOW_MS };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) for (const [ip, entry] of buckets) if (now >= entry.resetAt) buckets.delete(ip);
  const remaining = Math.max(0, RATE_LIMIT_MAX - bucket.count);
  res.setHeader('RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > RATE_LIMIT_MAX) {
    sendJson(res, 429, { error: 'Too many requests. Please wait a moment and try again.', retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }, { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) });
    return false;
  }
  return true;
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error('Request body is too large.'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('Send a valid JSON request body.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function validateApplication(body) {
  const clean = {
    internshipId: typeof body.internshipId === 'string' ? body.internshipId.trim() : '',
    fullName: typeof body.fullName === 'string' ? body.fullName.trim() : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
    education: typeof body.education === 'string' ? body.education.trim() : '',
    coverLetter: typeof body.coverLetter === 'string' ? body.coverLetter.trim() : ''
  };
  const errors = {};
  if (!internships.some(job => job.id === clean.internshipId)) errors.internshipId = 'Choose an available internship.';
  if (clean.fullName.length < 2 || clean.fullName.length > 80) errors.fullName = 'Enter your name (2–80 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) || clean.email.length > 254) errors.email = 'Enter a valid email address.';
  if (clean.education.length < 2 || clean.education.length > 120) errors.education = 'Enter your school or current course (2–120 characters).';
  if (clean.coverLetter.length < 30 || clean.coverLetter.length > 2000) errors.coverLetter = 'Write 30–2,000 characters about why you are applying.';
  return { clean, errors };
}
function safeStaticPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC, relative);
  return resolved.startsWith(PUBLIC + path.sep) || resolved === path.join(PUBLIC, 'index.html') ? resolved : null;
}
function createServer() {
  return http.createServer(async (req, res) => {
    securityHeaders(res);
    const origin = req.headers.origin;
    if (origin && origin !== ALLOWED_ORIGIN) return sendJson(res, 403, { error: 'This origin is not allowed.' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Vary', 'Origin');
    }
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
    catch { return sendJson(res, 400, { error: 'Invalid request URL.' }); }
    if (url.pathname.startsWith('/api/')) {
      if (!consumeRateLimit(req, res)) return;
      if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/api/internships') {
        const search = (url.searchParams.get('search') || '').trim().slice(0, 100).toLowerCase();
        const type = (url.searchParams.get('type') || '').trim();
        if (type && !types.has(type)) return sendJson(res, 400, { error: 'Choose a valid internship category.' });
        const items = internships.filter(job => (!type || job.type === type) && (!search || `${job.title} ${job.company} ${job.location} ${job.description} ${job.skills.join(' ')}`.toLowerCase().includes(search)));
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'POST' && url.pathname === '/api/applications') {
        if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return sendJson(res, 415, { error: 'Content-Type must be application/json.' });
        let body;
        try { body = await readJson(req); }
        catch (error) { return sendJson(res, error.status || 400, { error: error.message || 'Could not read request.' }); }
        if (!body || Array.isArray(body) || typeof body !== 'object') return sendJson(res, 400, { error: 'Send an application object.' });
        const { clean, errors } = validateApplication(body);
        if (Object.keys(errors).length) return sendJson(res, 422, { error: 'Please fix the highlighted fields.', fields: errors });
        const application = { id: crypto.randomUUID(), ...clean, submittedAt: new Date().toISOString(), status: 'received' };
        applications.push(application);
        return sendJson(res, 201, { message: 'Your application has been received.', application: { id: application.id, internshipId: application.internshipId, submittedAt: application.submittedAt, status: application.status } });
      }
      if (req.method === 'OPTIONS') return res.writeHead(204, { Allow: 'GET, POST, OPTIONS' }).end();
      return sendJson(res, 404, { error: 'API route not found.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
    const file = safeStaticPath(url.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(res, 404, { error: 'Page not found.' });
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
if (require.main === module) createServer().listen(PORT, () => console.log(`Internship board ready at http://localhost:${PORT}`));
module.exports = { createServer, internships, applications, validateApplication };
