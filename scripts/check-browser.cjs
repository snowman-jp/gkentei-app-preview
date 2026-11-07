/* Run against an isolated local server; never reads a user's browser profile. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.AUDIT_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({timezoneId:'Asia/Tokyo',viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];const results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 for(const file of ['index.html','stage1.html','all-lessons.html','level3.html']){
  await page.goto(`${base}/${file}`);
  assert.equal(await page.locator('#home').isVisible(),true);
  const count=await page.evaluate(()=>QUESTIONS.length);assert.equal(count,100);
  const checked=await page.evaluate(()=>{
   let attempts=0;
   for(const q of QUESTIONS){
    for(let choice=0;choice<4;choice++){
     queue=[q];i=0;session=[];sessionMode='normal';if(typeof activeCoach!=='undefined')activeCoach=new Map();
     show('quiz');render();const choices=typeof displayedChoices==='undefined'?q.o.map((text,originalIndex)=>({text,originalIndex})):displayedChoices;const n=choices.findIndex(c=>c.originalIndex===choice);choose(n);
     const ok=choice===q.a;
     if(session.length!==1||session[0].ok!==ok||session[0].chosen!==choice)throw Error(`grading Q${q.id}`);
     const correct=[...document.querySelectorAll('.choice.right')];
     if(correct.length!==1||!correct[0].textContent.includes(q.o[q.a]))throw Error(`display Q${q.id}`);
     if(!document.querySelector('#feedback').textContent.includes(q.o[q.a]))throw Error(`answer Q${q.id}`);
     if(q.lesson){
      for(const d of choices.filter(c=>c.originalIndex!==q.a)){
       if(!document.querySelector('#feedback').textContent.includes(q.lesson.wrong[d.originalIndex]))throw Error(`reason Q${q.id}`);
      }
     }
     const len=data.history.length;choose(n);if(data.history.length!==len)throw Error('double click');attempts++;
    }
   }
   return attempts;
  });assert.equal(checked,400);
  // Known legacy history: loading and updating must preserve old events.
  const seed={history:[{id:1,ok:false,at:'2026-11-01T03:00:00.000Z'},{id:2,ok:true,at:'2026-11-02T03:00:00.000Z'}],wrong:[1],sets:3};
  await page.evaluate(seed=>localStorage.setItem(KEY,JSON.stringify(seed)),seed);await page.reload();
  assert.equal(await page.locator('#attempts').textContent(),'2');
  if(file==='level3.html'){
   const before=await page.evaluate(()=>todayCoach.items.map(x=>x.id));assert.equal(before.length,5);assert.equal(new Set(before).size,5);
   await page.reload();assert.deepEqual(await page.evaluate(()=>todayCoach.items.map(x=>x.id)),before);
   await page.click('#coachStart');assert.equal(await page.locator('#number').textContent(),'1 / 5');
   assert.equal(await page.locator('#coachQuestionReason').isVisible(),true);
   await page.evaluate(()=>dashboard());
  }
  await page.click('#reviewStart');assert.equal(await page.evaluate(()=>queue.length),1);
  assert.equal(await page.evaluate(()=>queue[0].id),1);
  await page.evaluate(()=>choose(typeof displayedChoices==='undefined'?queue[i].a:displayedChoices.findIndex(c=>c.originalIndex===queue[i].a)));
  await page.click('#next');await page.click('#returnHome');
  assert.equal(await page.locator('#attempts').textContent(),'3');
  assert.equal(await page.evaluate(()=>data.wrong.includes(1)),false);
  assert.deepEqual(await page.evaluate(()=>data.history.slice(0,2)),seed.history);
  await page.reload();assert.equal(await page.locator('#attempts').textContent(),'3');
  await page.click('#start');
  for(let n=0;n<5;n++){
   await page.evaluate(()=>choose(typeof displayedChoices==='undefined'?queue[i].a:displayedChoices.findIndex(c=>c.originalIndex===queue[i].a)));await page.click('#next');
  }
  assert.match(await page.locator('#resultScore').textContent(),/5 \/ 5/);
  await page.click('#returnHome');assert.equal(await page.locator('#sets').textContent(),'4');
  await page.click('#smartStart');assert.equal(await page.evaluate(()=>new Set(queue.map(q=>q.id)).size),5);
  await page.evaluate(()=>dashboard());await page.click('#statsBtn');
  assert.equal(await page.locator('#statsContent .labelrow').count(),10);
  await page.click('#statsHome');
  await page.screenshot({path:`audit/${file.replace('.html','')}-mobile.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  results.push({file,questions:100,answerCases:checked,flows:['正誤判定・選択肢と解説対応','二重回答防止','既存履歴保持・再読込','誤答復習','5問完了とセット数','弱点優先','分野別成績',...(file==='level3.html'?['今日のおすすめ5問・日内再現・理由表示']:[])]});
 }
 assert.deepEqual(errors,[]);
 const result={status:'PASS',browser:'Chromium',isolatedProfile:true,timezone:'Asia/Tokyo',results,errors};fs.writeFileSync('audit/browser-test-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
