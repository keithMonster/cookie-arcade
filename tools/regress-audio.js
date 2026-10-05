// Playwright CLI run-code；仅本地或已部署静态游戏页面，无外部写入。
async page => {
 const results=[],errors=[];
 const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const root=new URL('../../',page.url()).href;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(window.__audioProbe)return;window.__audioProbe=true;window.audioTrace=[];
  const NativeAudio=window.Audio;
  window.Audio=function(...args){const a=new NativeAudio(...args),play=a.play.bind(a);a.play=function(){audioTrace.push({event:'play',time:performance.now(),src:a.src});return play();};a.addEventListener('playing',()=>audioTrace.push({event:'playing',time:performance.now(),src:a.src}));return a;};
  document.addEventListener('pointerdown',()=>window.inputTime=performance.now(),true);
 });
 await page.route('**/*.mp3',async route=>{await page.waitForTimeout(500);try{await route.continue();}catch(error){if(!String(error).includes('already handled')&&!String(error).includes('closed'))throw error;}});
 for(const [game,selector,element] of [['picnic','[data-food="0"]','voice'],['beads','[data-kind="0"]','voice'],['storybook','#cover','narrAudio'],['basket','#basket','vEl'],['shapes','#ask','qEl']]){
  await page.goto(root+`games/${game}/`);
  await page.waitForFunction(name=>window.eval(name).readyState>=3,element);
  await page.locator(selector).click();
  await page.waitForFunction(()=>audioTrace.some(x=>x.event==='playing'));
  const trace=await page.evaluate(()=>audioTrace.map(x=>({...x,time:Math.round(x.time-inputTime),src:x.src.split('/').pop()})));
  check(`${game} warm first sound under 350ms despite 500ms network delay`,trace.find(x=>x.event==='playing').time<350,trace);
  if(game==='beads')check('beads intro survives first input',trace.every(x=>x.src==='intro.mp3'),trace);
  if(game==='basket')check('basket unlock uses one audible play',trace.filter(x=>x.event==='play').length===1,trace);
 }
 await page.unroute('**/*.mp3');
 for(const game of ['picnic','beads','bus','road','elevator']){
  await page.goto(root+`games/${game}/`);
  await page.waitForFunction(()=>voice.readyState>=3);
  check(`${game} first clip ready before input`,await page.evaluate(()=>voice.currentTime===0&&voice.paused&&voice.readyState>=3));
  const warm=await page.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,800));return performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.mp3')).length;});
  check(`${game} page prepares additional speech`,warm>=5,warm);
 }
 await page.goto(root+'games/beads/');
 await page.evaluate(()=>{voice.play=()=>Promise.reject(Error('blocked'));});
 await page.locator('[data-kind="0"]').click();
 check('blocked audio does not prevent selection',await page.evaluate(()=>selected===0));
 await page.goto(root+'games/road/');
 await page.keyboard.press('a');
 check('road preloaded src still allows first guidance',await page.evaluate(()=>begun&&audioTrace.some(x=>x.event==='play')));
 check('no JavaScript errors',errors.length===0,errors);
 return {passed:results.length,results};
}
