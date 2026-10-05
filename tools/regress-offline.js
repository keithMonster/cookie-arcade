async page => {
 const root=new URL('../../',page.url()).href, results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 await page.goto(root);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 const cached=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('cookie-arcade-offline-'));const c=await caches.open(names.at(-1));return {names,count:(await c.keys()).length};});
 check('complete offline cache installed',cached.count===549,cached);
 await page.context().setOffline(true);
 try{
  for(const game of ["animals", "basket", "bath", "beads", "bubbles", "bus", "cars", "cascade", "drums", "echo", "elevator", "feed", "find", "helper", "keyboard", "outing", "peekaboo", "picnic", "road", "scribble", "shapes", "sleep", "sort", "storybook", "train", "tw-bubbles", "tw-chorus", "tw-mood", "tw-more", "tw-summon", "waterwheel", "words"]){
   await page.goto(root+`games/${game}/`);
   const back=await page.locator('#back').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
   check(`${game} opens offline with usable back`,back.width>=44&&back.hit,back);
  }
  await page.goto(root+'games/picnic/');
  await page.locator('[data-food="0"]').click();await page.waitForFunction(()=>voice.currentTime>0.1&&!voice.paused);
  check('offline first speech really advances',await page.evaluate(()=>voice.currentTime>0));
  const range=await page.evaluate(async()=>{const response=await fetch('audio/intro.mp3',{headers:{Range:'bytes=0-9'}});return {status:response.status,length:(await response.arrayBuffer()).byteLength,range:response.headers.get('content-range')};});
  check('offline media byte ranges',range.status===206&&range.length===10,range);
 } finally {await page.context().setOffline(false);}
 check('no script errors across 32 offline games',errors.length===0,errors);
 return {passed:results.length,results};
}
