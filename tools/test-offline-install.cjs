// 本地 VM 验证安装并发、失败取消与活动缓存保留，不发网络请求。
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(require('node:path').join(__dirname, '../service-worker.js'), 'utf8');

async function scenario({mode = 'success', existed = false} = {}) {
  let active = 0, peak = 0, writes = 0, calls = 0, deleted = false, skipped = false, install;
  const self = {
    registration: {scope: 'https://example.test/arcade/'}, location: {origin: 'https://example.test'},
    addEventListener: (name, fn) => { if (name === 'install') install = fn; },
    skipWaiting: () => { skipped = true; },
  };
  const add = async request => {
    active++; calls++; peak = Math.max(peak, active);
    const call = calls;
    try {
      await new Promise((resolve, reject) => {
        if (request.signal.aborted) return reject(Error('aborted'));
        const abort = () => { clearTimeout(timer); reject(Error('aborted')); };
        const hang = mode === 'hang' || (mode === 'fail-with-hang' && call > 1);
        const timer = hang ? undefined : setTimeout(() => {
          request.signal.removeEventListener('abort', abort);
          if (mode !== 'success' && call === 1) reject(Error('missing asset'));
          else resolve();
        }, 1);
        request.signal.addEventListener('abort', abort, {once: true});
      });
      writes++;
    } finally { active--; }
  };
  const caches = {
    has: async () => existed, open: async () => ({add}),
    delete: async () => { assert.equal(active, 0); deleted = true; },
  };
  vm.runInNewContext(source, {
    self, caches, URL, Request, Response, AbortController, clearTimeout,
    setTimeout: (fn, ms) => setTimeout(fn, ms === 20000 ? 25 : ms),
  });
  let pending;
  install({waitUntil: promise => { pending = promise; }});
  if (mode === 'success') await pending;
  else await assert.rejects(pending, /missing asset|aborted/);
  assert.equal(active, 0);
  assert.ok(peak <= 4 && peak > 1);
  assert.equal(skipped, mode === 'success');
  assert.equal(deleted, mode !== 'success' && !existed);
  if (mode !== 'success') assert.ok(calls <= 4, '失败后不得继续下载队列');
  return {mode, existed, peak, calls, writes, deleted, skipped};
}

(async () => {
  const results = [];
  for (const mode of ['success', 'fail', 'fail-with-hang', 'hang']) {
    for (const existed of [false, true]) results.push(await scenario({mode, existed}));
  }
  console.log(JSON.stringify({passed: results.length, results}));
})().catch(error => { console.error(error); process.exitCode = 1; });
