const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

const server = createServer();
let base;
const ready = new Promise(resolve => server.listen(0, '127.0.0.1', () => {
  base = `http://127.0.0.1:${server.address().port}`;
  resolve();
}));
after(() => new Promise(resolve => server.close(resolve)));

test('health endpoint returns JSON and security headers', async () => {
  await ready;
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('internships can be listed, searched and filtered', async () => {
  await ready;
  const all = await (await fetch(`${base}/api/internships`)).json();
  assert.equal(all.total, 6);
  const filtered = await (await fetch(`${base}/api/internships?type=Design&search=prototype`)).json();
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].id, 'int-103');
});

test('invalid category returns 400', async () => {
  await ready;
  const response = await fetch(`${base}/api/internships?type=Nope`);
  assert.equal(response.status, 400);
});

test('application fields are validated server-side and valid submission is accepted', async () => {
  await ready;
  const invalid = await fetch(`${base}/api/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: '<b>J</b>' }) });
  assert.equal(invalid.status, 422);
  assert.ok((await invalid.json()).fields.email);
  const valid = await fetch(`${base}/api/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ internshipId: 'int-101', fullName: 'Taylor Example', email: 'TAYLOR@EXAMPLE.COM', education: 'Computer Science, Year 2', coverLetter: 'I would love to learn from the team and build useful accessible products.' }) });
  assert.equal(valid.status, 201);
  const body = await valid.json();
  assert.equal(body.application.status, 'received');
  assert.ok(body.application.id);
});

test('requests from an unapproved browser origin are rejected', async () => {
  await ready;
  const response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://example.invalid' } });
  assert.equal(response.status, 403);
});

test('unknown routes return 404', async () => {
  await ready;
  const response = await fetch(`${base}/api/missing`);
  assert.equal(response.status, 404);
});
