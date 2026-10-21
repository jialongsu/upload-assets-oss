const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const qiniu = require('qiniu');
const { vitePluginQiniu, WebpackPluginQiniu } = require('../dist/index.cjs');

const options = {
  accessKey: 'test-access-key',
  secretKey: 'test-secret-key',
  bucket: 'test-bucket',
  rootName: 'project/dev/1.0.0',
};

function fixture(t, filenames) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-upload-test-'));
  for (const filename of filenames) {
    const filePath = path.join(directory, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, filename);
  }
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function mockSdk(t, reply = (_key, callback) => callback(null, {}, { statusCode: 200 })) {
  const calls = [];
  const logs = [];
  t.mock.method(console, 'log', (message) => logs.push(message));
  const list = t.mock.method(qiniu.rs.BucketManager.prototype, 'listPrefix',
    (_bucket, _options, callback) => callback(null, { items: [] }, { statusCode: 200 }));
  t.mock.method(qiniu.form_up.FormUploader.prototype, 'putFile',
    (token, key, filePath, _extra, callback) => {
      const policy = JSON.parse(Buffer.from(token.split(':')[2], 'base64url').toString());
      calls.push({ key, filePath, policy });
      setImmediate(() => reply(key, callback, { policy, filePath }));
    });
  return { calls, logs, list };
}

async function uploadWithVite(directory, extraOptions = {}) {
  const plugin = vitePluginQiniu({ ...options, ...extraOptions });
  await plugin.configResolved({ build: { outDir: directory } });
  return plugin.closeBundle();
}

function uploadWithWebpack(directory, filenames) {
  let handler;
  new WebpackPluginQiniu(options).apply({
    hooks: { afterEmit: { tapAsync: (_name, callback) => { handler = callback; } } },
  });
  return new Promise((resolve, reject) => {
    handler({
      assets: Object.fromEntries(filenames.map((filename) => [filename, {}])),
      options: { output: { path: directory } },
    }, (error) => error ? reject(error) : resolve());
  });
}

test('HTML 使用对应文件的覆盖凭证，其他文件使用仅新增凭证', async (t) => {
  const filenames = ['index.html', 'nested/PAGE.HTML', 'assets/app-12345678.js', 'config.json'];
  const directory = fixture(t, filenames);
  const { calls, list } = mockSdk(t);
  await uploadWithVite(directory);
  assert.equal(calls.length, filenames.length);
  for (const { key, filePath, policy } of calls) {
    const isHtml = path.extname(key).toLowerCase() === '.html';
    assert.equal(policy.scope, isHtml ? `${options.bucket}:${key}` : options.bucket);
    assert.equal(policy.insertOnly, isHtml ? 0 : 1);
    assert.equal(policy.forceInsertOnly, !isHtml);
    assert.equal(fs.existsSync(filePath), true);
  }
  assert.equal(list.mock.callCount(), 0, '上传不依赖有分页限制的远端列表');
});

test('相同内容重复上传时，HTML 成功，非 HTML 计为跳过', async (t) => {
  const directory = fixture(t, ['app.js', 'config.json', 'index.html']);
  const remoteFiles = new Map();
  const { logs } = mockSdk(t, (key, callback, { policy, filePath }) => {
    const content = fs.readFileSync(filePath, 'utf8');
    // 七牛普通仅新增策略允许同名同内容返回成功，强制仅新增才返回重复错误。
    if (remoteFiles.has(key) && policy.insertOnly &&
      (policy.forceInsertOnly || remoteFiles.get(key) !== content)) {
      callback(null, { error: 'file exists' }, { statusCode: 614 });
      return;
    }
    remoteFiles.set(key, content);
    callback(null, {}, { statusCode: 200 });
  });
  await uploadWithVite(directory);
  await uploadWithVite(directory);
  const results = logs.filter((message) => message.includes('上传结果'));
  assert.match(results[0], /成功 3.*跳过 0.*失败 0/);
  assert.match(results[1], /成功 1.*跳过 2.*失败 0/);
});

test('非 HTML 遇到 614 file exists 后跳过，并继续上传剩余文件', async (t) => {
  const directory = fixture(t, ['a.js', 'b.html', 'c.css']);
  const { calls, logs } = mockSdk(t, (key, callback) => {
    if (key.endsWith('a.js')) callback(null, { error: 'file exists' }, { statusCode: 614 });
    else callback(null, {}, { statusCode: 200 });
  });
  await uploadWithVite(directory, { forceDelete: true });
  assert.equal(calls.length, 3);
  assert.ok(logs.some((message) => /成功 2.*跳过 1.*失败 0/.test(message)));
});

for (const [name, filename, reply, expected] of [
  ['HTML 的重复错误不能跳过', 'a.html', (cb) => cb(null, { error: 'file exists' }, { statusCode: 614 }), /a\.html/],
  ['非重复的服务错误不能跳过', 'a.js', (cb) => cb(null, { error: 'server error' }, { statusCode: 500 }), /server error/],
  ['状态码不匹配的 file exists 不能跳过', 'a.js', (cb) => cb(null, { error: 'file exists' }, { statusCode: 500 }), /500/],
  ['网络错误通过 Promise 返回', 'a.js', (cb) => cb(new Error('network timeout')), /network timeout/],
]) {
  test(name, async (t) => {
    const directory = fixture(t, [filename, 'z.html']);
    const { calls, logs } = mockSdk(t, (key, callback) => {
      if (key.endsWith(filename)) reply(callback);
      else callback(null, {}, { statusCode: 200 });
    });
    await assert.rejects(uploadWithVite(directory), expected);
    assert.equal(calls.length, 2, '失败后仍处理剩余文件，最后统一返回失败');
    assert.ok(logs.every((message) => !message.includes('👏  上传完成')));
  });
}

test('Vite 在最后一个文件上传完成前不结束', async (t) => {
  const directory = fixture(t, ['index.html']);
  let release;
  let finished = false;
  mockSdk(t, (_key, callback) => { release = callback; });
  const uploading = uploadWithVite(directory).then(() => { finished = true; });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  release(null, {}, { statusCode: 200 });
  await uploading;
  assert.equal(finished, true);
});

test('Webpack 等待上传，并允许非 HTML 重复文件跳过', async (t) => {
  const filenames = ['a.js', 'b.html'];
  const directory = fixture(t, filenames);
  const { calls } = mockSdk(t, (key, callback) => {
    callback(null, key.endsWith('.js') ? { error: 'file exists' } : {},
      { statusCode: key.endsWith('.js') ? 614 : 200 });
  });
  await uploadWithWebpack(directory, filenames);
  assert.equal(calls.length, 2);
});

test('Webpack 将真正的上传失败传递给构建回调', async (t) => {
  const directory = fixture(t, ['index.html']);
  mockSdk(t, (_key, callback) => callback(null, { error: 'denied' }, { statusCode: 403 }));
  await assert.rejects(uploadWithWebpack(directory, ['index.html']), /denied/);
});

test('空目录不请求七牛', async (t) => {
  const directory = fixture(t, []);
  const { calls, list } = mockSdk(t);
  await uploadWithVite(directory);
  assert.equal(calls.length, 0);
  assert.equal(list.mock.callCount(), 0);
});
