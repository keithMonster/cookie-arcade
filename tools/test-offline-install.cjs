// 本地响应与缓存夹具：直接执行生产SW，验证增量复用、完整性与取消边界。
const {readFileSync} = require('node:fs');
const {createHash, webcrypto} = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const raw = readFileSync(require('node:path').join(__dirname, '../service-worker.js'), 'utf8');
const base = 'https://example.test/arcade/';
const name = 'cookie-arcade-offline-unit';
const oldName = 'cookie-arcade-offline-old';
const assets = {'./':'home', './index.html':'home', './game/':'game', './sound.mp3':'audio', './icon.png':'icon'};
const hashes = Object.fromEntries(Object.entries(assets).map(([p, body]) => [p, createHash('sha256').update(body).digest('hex')]));
const source = raw.replace(/\/\/ BEGIN GENERATED OFFLINE MANIFEST[\s\S]*?\/\/ END GENERATED OFFLINE MANIFEST/,
  `const CACHE_VERSION='unit'; const PRECACHE_PATHS=${JSON.stringify(Object.keys(assets))}; const PRECACHE_HASHES=${JSON.stringify(hashes)};`);
const entries = data => new Map(Object.entries(data).map(([p, body]) => [new URL(p, base).href, body]));

async function scenario(label, options = {}) {
  const data = new Map();
  if (options.old) data.set(oldName, entries(options.old));
  if (options.current) data.set(name, entries(options.current));
  const oldBefore = JSON.stringify([...(data.get(oldName) || [])]);
  const existed = data.has(name), fetched = [];
  let skipped = false, activeWrites = 0, peakFetch = 0, activeFetch = 0, puts = 0, install;
  const releaseFetch = [], productionTimers = [];
  const caches = {
    keys: async () => [...data.keys()],
    has: async key => data.has(key),
    delete: async key => { assert.equal(activeWrites, 0, '晚到写入必须先退出'); return data.delete(key); },
    open: async key => {
      if (!data.has(key)) data.set(key, new Map());
      return {
        match: async request => data.get(key).has(request.url) ? new Response(data.get(key).get(request.url)) : undefined,
        put: async (request, response) => {
          activeWrites++;
          try {
            if (options.slowPut) await new Promise(r => setTimeout(r, 110));
            if (options.quota && request.url.endsWith('/sound.mp3')) throw Error('quota');
            data.get(key).set(request.url, await response.text()); puts++;
          } finally { activeWrites--; }
        },
      };
    },
  };
  const fetch = async request => {
    fetched.push(request.url); activeFetch++; peakFetch = Math.max(peakFetch, activeFetch);
    try {
      await new Promise((resolve, reject) => {
        if (request.signal.aborted) return reject(Error('aborted'));
        const abort = () => { clearTimeout(timer); reject(Error('aborted')); };
        const release = () => {
          request.signal.removeEventListener('abort', abort);
          resolve();
        };
        const waiting = options.hang || (options.hangOthers && request.url !== base);
        const timer = waiting ? undefined : setTimeout(release, 1);
        if(options.hang) releaseFetch.push(release);
        request.signal.addEventListener('abort', abort, {once:true});
      });
      const path = './' + request.url.slice(base.length);
      return new Response(options.mismatch ? 'wrong release' : assets[path], {status:options.httpError || options.hangOthers ? 503 : 200});
    } finally { activeFetch--; }
  };
  const self = {
    registration:{scope:base}, location:{origin:'https://example.test'},
    addEventListener:(type, fn) => {if(type==='install') install=fn;},
    skipWaiting:() => {skipped=true;},
  };
  vm.runInNewContext(source, {self,caches,fetch,crypto:webcrypto,URL,Request,Response,AbortController,Uint8Array,
    clearTimeout,setTimeout:(fn,ms)=>{productionTimers.push(ms);return setTimeout(fn,ms===20000?75:ms);}});
  let pending;
  install({waitUntil:promise=>{pending=promise;}});
  if(options.hang){
    let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
    await new Promise(resolve=>setTimeout(resolve,110));
    assert.equal(settled,false,'慢请求必须继续等待，不能因时间失败');
    assert.equal(skipped,false,'慢请求未完成不能启用新版');
    assert.equal(JSON.stringify([...(data.get(oldName)||[])]),oldBefore);
    releaseFetch.forEach(release=>release());
  }
  if(options.fail) await assert.rejects(pending);
  else await pending;
  assert.equal(skipped,!options.fail);
  assert.deepEqual(productionTimers,[],'生产下载不得设置固定截止时间');
  assert.equal(activeWrites,0); assert.equal(activeFetch,0); assert.ok(peakFetch<=4);
  assert.equal(JSON.stringify([...(data.get(oldName)||[])]),oldBefore,'旧版必须完整保留');
  if(options.fail) assert.equal(data.has(name),existed,'只清本次新建的候选缓存');
  else assert.deepEqual([...data.get(name)].sort(),[...entries(assets)].sort());
  if(options.downloads!==undefined) assert.equal(fetched.length,options.downloads);
  if(options.puts!==undefined) assert.equal(puts,options.puts);
  return {label,passed:true,downloads:fetched.length,puts,skipped};
}
(async()=>{
  const {['./sound.mp3']: ignored,...missing}=assets;
  const scenarios = [
    ['首次完整安装',{downloads:5}],
    ['旧版无hash元数据全复用',{old:assets,downloads:0}],
    ['只改首页及目录别名',{old:{...assets,'./':'old home','./index.html':'old home'},downloads:2}],
    ['旧缓存损坏仅重下该文件',{old:{...assets,'./sound.mp3':'bad'},downloads:1}],
    ['旧缓存缺项仅补该文件',{old:missing,downloads:1}],
    ['同名完整缓存不下载不重写',{current:assets,downloads:0,puts:0}],
    ['同名部分缓存补齐',{current:missing,downloads:1}],
    ['200但正文不符拒绝激活',{old:{...assets,'./sound.mp3':'old'},mismatch:true,fail:true}],
    ['HTTP失败保留旧缓存',{old:missing,httpError:true,fail:true}],
    ['慢网络持续等待并最终完成',{old:missing,hang:true,downloads:1}],
    ['真实HTTP失败取消其他等待请求',{hangOthers:true,fail:true}],
    ['同名部分缓存失败不删除',{current:missing,httpError:true,fail:true}],
    ['本地缓存写入缓慢仍完整启用',{old:assets,slowPut:true,downloads:0}],
    ['存储空间不足不误激活',{old:assets,quota:true,fail:true}],
  ];
  const results=[];
  for(const [label,options] of scenarios) results.push(await scenario(label,options));
  console.log(JSON.stringify({passed:results.length,results}));
})().catch(error=>{console.error(error);process.exitCode=1;});
