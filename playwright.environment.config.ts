import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'environment-preflight.spec.ts',fullyParallel:false,forbidOnly:!!process.env.CI,retries:0,workers:1,timeout:90000,reporter:[['list'],['json',{outputFile:process.env.YINGZUO_ENV_REPORT??'docs/evidence/environment-preflight-run.json'}]],
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',serviceWorkers:'block'},
  projects:[{name:'desktop-1920x1080',use:{...devices['Desktop Chrome'],viewport:{width:1920,height:1080}}},
    {name:'desktop-1024x768',use:{...devices['Desktop Chrome'],viewport:{width:1024,height:768}}},
    {name:'reduce-desktop',metadata:{forced2D:true},use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900},reducedMotion:'reduce'}},
    {name:'reduce-mobile',metadata:{forced2D:true},use:{...devices['Pixel 7'],viewport:{width:390,height:844},reducedMotion:'reduce'}}],
  webServer:{command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false},
});
