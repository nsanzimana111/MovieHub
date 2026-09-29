import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.FRONTEND_URL = 'https://moviehub-web.onrender.com';
const { default: app } = await import('../src/app.js');

test('registration preflight allows the MovieHub Render frontend origin', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://moviehub-web.onrender.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://moviehub-web.onrender.com');
});
