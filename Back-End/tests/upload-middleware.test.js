import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { uploadMovieAssets } from '../src/config/upload.js';

test('accepts movieFile and poster in one multipart request', async (t) => {
  const app = express();
  let uploadedPaths = [];

  app.post('/upload', uploadMovieAssets, async (req, res) => {
    uploadedPaths = [...(req.files.movieFile || []), ...(req.files.poster || [])].map((file) => file.path);
    res.json({ fields: Object.keys(req.files).sort() });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await Promise.all(uploadedPaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const form = new FormData();
  form.append('movieFile', new Blob(['sample video'], { type: 'video/mp4' }), 'sample.mp4');
  form.append('poster', new Blob(['sample image'], { type: 'image/png' }), 'poster.png');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, {
    method: 'POST',
    body: form,
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).fields, ['movieFile', 'poster']);
  assert.ok(uploadedPaths.every((filePath) => path.isAbsolute(filePath)));
});
