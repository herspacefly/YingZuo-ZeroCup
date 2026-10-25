import {test,expect} from './formal-fixture';
test('regular Kai uses the local WOFF fallback when WOFF2 is unavailable',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('regular-kai.'))requests.push(r.url());});
 await page.route('**/regular-kai.woff2',route=>route.abort());await page.goto('/#/about');
 const loaded=await page.evaluate(async()=>{const faces=await document.fonts.load('17px "Yingzuo Kai"','沉香灯火');return faces.length>0&&faces.every(f=>f.status==='loaded');});
 expect(loaded).toBe(true);expect(requests.some(u=>u.endsWith('regular-kai.woff'))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
