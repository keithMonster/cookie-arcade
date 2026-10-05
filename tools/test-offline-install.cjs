// 本地 VM 验证安装并发、失败清理与活动缓存保留，不发网络请求。
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(require('node:path').join(__dirname,'../service-worker.js'),'utf8');
async function scenario({fail=false,existed=false}={}){
 let active=0,peak=0,writes=0,deleted=false,skipped=false,install;
 const self={registration:{scope:'https://example.test/arcade/'},location:{origin:'https://example.test'},addEventListener:(name,fn)=>{if(name==='install')install=fn;},skipWaiting:()=>{skipped=true;}};
 const caches={has:async()=>existed,open:async()=>({add:async request=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;writes++;if(fail&&request.url.endsWith('/icon-512.png'))throw Error('missing asset');}}),delete:async()=>{assert.equal(active,0);deleted=true;}};
 vm.runInNewContext(source,{self,caches,URL,Request,Response});
 let pending;install({waitUntil:p=>pending=p});
 if(fail)await assert.rejects(pending,/missing asset/);else await pending;
 assert.equal(active,0);assert.ok(peak<=4&&peak>1);assert.equal(skipped,!fail);assert.equal(deleted,fail&&!existed);
 return {fail,existed,peak,writes,deleted,skipped};
}
(async()=>{const results=[];for(const fail of [false,true])for(const existed of [false,true])results.push(await scenario({fail,existed}));console.log(JSON.stringify({passed:results.length,results}));})().catch(e=>{console.error(e);process.exitCode=1;});
