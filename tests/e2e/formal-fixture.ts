import {test as base,expect} from '@playwright/test';
// Existing workflow suites exercise the formal controls. Explicitly skip the new
// optional rehearsal on each entry; presentation-guidance/guide-lifecycle keep
// the unmodified Playwright fixture and test rehearsal through real input.
export const test=base.extend({page:async({page},use)=>{
 await page.addInitScript(()=>new MutationObserver(()=>document.querySelector<HTMLButtonElement>('#guide-skip')?.click()).observe(document,{childList:true,subtree:true}));
 await use(page);
}});
export {expect};
