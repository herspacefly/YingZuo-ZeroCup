import {test,expect} from '@playwright/test';

test('v5 rehearsal is silent and storage failure cancels the formal voice channel',async({page})=>{
 test.setTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  const Native=window.Audio,players:HTMLAudioElement[]=[];
  window.Audio=class extends Native{constructor(src?:string){super(src);players.push(this);}};
  Reflect.set(window,'__isolationVoices',()=>players.filter(p=>p.src.includes('/audio/voice-v5/')).map(p=>({paused:p.paused,time:p.currentTime,ready:p.readyState})));
 });
 await page.goto('/#/story');await page.locator('#story-start').click();
 await expect(page.locator('.guide-banner')).toBeVisible();await page.locator('#story-play').click();
 await expect(page.locator('.guide-banner')).toContainText('把这一刻停下来');
 // Formal entry may have requested its first clip before the rehearsal mounts;
 // the isolation contract requires cancellation, rather than zero prior fetches.
 expect(await page.evaluate(()=>Reflect.get(window,'__isolationVoices')().every((p:{paused:boolean})=>p.paused))).toBe(true);
 await expect(page.locator('#story-voice-toggle')).toBeHidden();
 await page.locator('#story-pause').click();await page.locator('.subtitle-cue').last().click();
 await expect(page.locator('.guide-banner')).toHaveCount(0);
 // Revealing the full-resolution real stage can trip the existing gap guard in
 // software rendering. Settle that reveal, then exercise explicit resumption.
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 if(await page.locator('#story-runtime').getAttribute('data-state')==='paused')await page.locator('#story-play').click();
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__isolationVoices')().some((p:{paused:boolean;time:number;ready:number})=>!p.paused&&p.ready>=2&&p.time>.05))).toBe(true);
 await page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;let fail=true;
  IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'&&fail){fail=false;throw new DOMException('Injected voice save failure','QuotaExceededError');}return put.call(this,value,key);};
 });
 await page.locator('#story-next-node').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');
 await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','saving');
 expect(await page.evaluate(()=>Reflect.get(window,'__isolationVoices')().every((p:{paused:boolean})=>p.paused))).toBe(true);
 await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing','false');
 await page.locator('#retry-save').click();await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','craft');
 await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');
 expect(await page.evaluate(()=>Reflect.get(window,'__isolationVoices')().every((p:{paused:boolean})=>p.paused))).toBe(true);
});
