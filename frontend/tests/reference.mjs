import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
 await page.goto('https://sgis.mods.go.kr/view/house/houseAnalysisMap',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(5000);
 await page.screenshot({path:'../var/ui-reference/sgis.png',fullPage:true});
 console.log((await page.locator('body').innerText()).slice(-5000));
} finally {await browser.close();}
