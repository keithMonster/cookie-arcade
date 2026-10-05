// Playwright CLI run-code：同站热区回归；不截图，不覆盖历史证据。
async (page) => {
  const results=[], errors=[];
  const origin=/^https?:/.test(page.url())?new URL('../../',page.url()).href.replace(/\/$/,''):'http://127.0.0.1:8766';
  const onError=error=>errors.push(error.message);
  page.on('pageerror',onError);
  const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
  const visit=async game=>{await page.goto(`${origin}/games/${game}/`);await page.waitForSelector('#back');};
  const center=async selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const edge=async(selector,pad=20)=>page.locator(selector).evaluate((el,pad)=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.top-pad};},pad);
  const drag=async(selector,to)=>{
    const from=await center(selector);await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
  };
  const far={x:1016,y:8};
  const settle=()=>page.waitForFunction(()=>phase==='idle'||phase==='success');
  try {
    await page.setViewportSize({width:1024,height:768});
    await visit('beads');
    let kind=await page.evaluate(()=>expected());
    await drag(`[data-kind="${kind}"]`,far);
    check('beads：远离目标不填珠',await page.evaluate(()=>next===4));
    await drag(`[data-kind="${1-kind}"]`,await edge('[data-slot="4"]'));
    check('beads：20px容差不放行错珠',await page.evaluate(()=>next===4));
    await drag(`[data-kind="${kind}"]`,await edge('[data-slot="5"]'));
    check('beads：后一个空位不代填前一个',await page.evaluate(()=>next===4));
    await drag(`[data-kind="${kind}"]`,await edge('[data-slot="4"]'));
    check('beads：目标外20px成功',await page.evaluate(()=>next===5));
    kind=await page.evaluate(()=>expected());
    await drag(`[data-kind="${kind}"]`,await center('[data-slot="4"]'));
    check('beads：已填目标不转投未填目标',await page.evaluate(()=>next===5));

    await visit('picnic');
    await drag('[data-food="0"]',far);
    check('picnic：远离目标不喂食',await page.evaluate(()=>!fed.some(Boolean)));
    await drag('[data-food="0"]',await edge('[data-guest="0"]'));
    check('picnic：目标外20px成功',await page.evaluate(()=>fed[0]&&used[0]));
    await drag('[data-food="1"]',await center('[data-guest="0"]'));
    check('picnic：正在嚼的目标不转投旁边小兔',await page.evaluate(()=>!used[1]&&!fed[1]));
    await page.waitForFunction(()=>!chewing[0]);
    await drag('[data-food="1"]',await edge('[data-guest="0"]'));
    check('picnic：已喂目标边缘不代喂未喂小兔',await page.evaluate(()=>!used[1]&&!fed[1]));

    await visit('road');
    const roadPick=async wrong=>page.evaluate(wrong=>pieces.findIndex(p=>(p.type===holes[0].type)!==wrong),wrong);
    const gapSelector='#board .gap';
    let index=await roadPick(false);
    await drag(`#tray .piece:nth-child(${index+1})`,far);
    check('road：远离目标不接路',await page.evaluate(()=>!holes.some(g=>g.filled)));
    index=await roadPick(true);
    const firstGap=await page.locator(gapSelector).first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.top-20};});
    await drag(`#tray .piece:nth-child(${index+1})`,firstGap);
    check('road：边缘容差不放行错误路块',await page.evaluate(()=>!holes.some(g=>g.filled)));
    index=await roadPick(false);
    await drag(`#tray .piece:nth-child(${index+1})`,firstGap);
    check('road：目标外20px成功',await page.evaluate(()=>holes[0].filled));
    const filledBefore=await page.evaluate(()=>holes.filter(g=>g.filled).length);
    const filledPoint=await page.locator(gapSelector).first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await drag(`#tray .piece:nth-child(${index+1})`,filledPoint);
    check('road：已填洞不转投其它洞',await page.evaluate(n=>holes.filter(g=>g.filled).length===n,filledBefore));

    await visit('bus');await settle();
    await page.locator('#door-button').click();await settle();
    const leaving=await page.evaluate(()=>leaving);
    const rider=`[data-person="${leaving}"]`,wrongRider=`[data-person="${1-leaving}"]`;
    await drag('#waiting',await center('#door'));await settle();
    check('bus：不能先上后下',await page.evaluate(()=>!boarded&&!unloaded));
    await drag(wrongRider,await edge('#station'));await settle();
    check('bus：容差不放行错乘客',await page.evaluate(()=>!unloaded));
    await drag(rider,far);await page.waitForTimeout(220);
    check('bus：远离目标不下车',await page.evaluate(()=>!unloaded&&!pending));
    const source=await center(rider),destination=await center('#station');
    await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:8});
    await page.mouse.move(source.x,source.y,{steps:8});await page.mouse.up();await page.waitForTimeout(220);
    check('bus：拖回原地取消',await page.evaluate(()=>!unloaded&&!pending));
    await drag(rider,await edge('#station'));await settle();
    check('bus：站牌外20px成功下车',await page.evaluate(()=>unloaded&&!boarded));
    const busEdge=await page.locator('#bus').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.right+20,y:r.top+24};});
    await drag('#waiting',busEdge);await settle();
    check('bus：车身外20px成功上车',await page.evaluate(()=>boarded&&unloaded));
    await visit('bus');await settle();
    await page.locator('#door-button').click();await settle();
    const nextLeaving=await page.evaluate(()=>leaving);
    await drag(`[data-person="${nextLeaving}"]`,await center('#station'));await settle();
    await drag('#waiting',await center(`[data-person="${1-nextLeaving}"]`));await settle();
    check('bus：车内乘客区域也能接住上车动物',await page.evaluate(()=>boarded&&unloaded));

    await visit('elevator');
    const resetElevator=()=>page.evaluate(()=>{dealRound();floor=0;targetFloor=2;successCount=0;render();});
    const close='[data-action="close"]',open='[data-action="open"]';
    await resetElevator();
    const near=await page.locator(close).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.bottom+12};});
    await drag(close,near);await settle();
    check('elevator：按钮外12px松手执行',await page.evaluate(()=>doors==='closed'));
    await resetElevator();await drag(close,far);await settle();
    check('elevator：远离按钮松手取消',await page.evaluate(()=>doors==='open'));
    await drag(close,await center(open));await settle();
    check('elevator：跨邻按钮松手不执行原按钮',await page.evaluate(()=>doors==='open'&&!press));

    const targets={beads:'#friend,.slot,.choice',picnic:'.guest,.food',bus:'#station,.rider,#waiting,.control',road:'.gap,.piece,#car',elevator:'#mission,.room,.control'};
    for(const [width,height] of [[320,568],[844,390]]) {
      await page.setViewportSize({width,height});
      for(const game of Object.keys(targets)) {
        await visit(game);
        const layout=await page.evaluate(selector=>{
          const back=document.querySelector('#back'),r=back.getBoundingClientRect(),pseudo=getComputedStyle(back,'::before');
          const pad=-parseFloat(pseudo.left),points=[[r.left-6,r.y+r.height/2],[r.right+6,r.y+r.height/2],[r.x+r.width/2,r.top-6],[r.x+r.width/2,r.bottom+6]];
          const backHit=points.every(([x,y])=>back.contains(document.elementFromPoint(x,y)));
          const items=[...document.querySelectorAll(selector)].map(el=>{const b=el.getBoundingClientRect();return {name:el.getAttribute('aria-label'),x:b.x,y:b.y,w:b.width,h:b.height,hit:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});
          return {backWidth:r.width+pad*2,backHeight:r.height+pad*2,backHit,items};
        },targets[game]);
        check(`${game} ${width}x${height}：返回64px热区四边可命中`,layout.backWidth===64&&layout.backHeight===64&&layout.backHit,layout);
        check(`${game} ${width}x${height}：其它目标可见无遮挡`,layout.items.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1&&r.hit),layout.items);
      }
    }
    check('无页面JS异常',errors.length===0,errors);
    return {passed:results.length,results};
  } finally {page.removeListener('pageerror',onError);}
}
