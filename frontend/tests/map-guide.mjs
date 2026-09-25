import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(import.meta.dirname,'../../var/map-guide');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64')}));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.APP_URL||'http://127.0.0.1:3019';
const guide=page.getByRole('dialog'),help=page.getByRole('button',{name:'지도 사용법',exact:true});
try{
 await page.goto(url);await expect(guide).toBeVisible();await expect(guide.locator('li')).toHaveCount(3);await expect(page.locator('.heat-journey .journey-number')).toHaveCount(0);
 await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 await page.screenshot({path:path.join(out,'desktop.png')});
 const instance=await page.locator('.map-canvas').getAttribute('data-map-instance');
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await guide.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press('Escape');await expect(guide).not.toBeVisible();await expect(help).toBeFocused();
 await page.reload();await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});await expect(guide).not.toBeVisible();
 await help.click();await expect(guide).toBeVisible();await page.getByRole('button',{name:'동네 찾으며 시작',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'동네 이름 검색'})).toBeFocused();
 await page.getByRole('combobox',{name:'동네 이름 검색'}).fill('우1동');await page.getByRole('combobox',{name:'동네 이름 검색'}).press('Enter');await expect(page.locator('.selected-region')).toContainText('우1동');
 const region=await page.locator('main').getAttribute('data-region'),currentInstance=await page.locator('.map-canvas').getAttribute('data-map-instance');
 await help.click();await page.getByRole('button',{name:'기온 기록 먼저 보기',exact:true}).click();
 await expect(page.getByLabel('선택 관측소 기온')).toBeVisible({timeout:15000});await expect(page.getByRole('button',{name:'기온 기록',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('main')).toHaveAttribute('data-region',region);await expect(page.locator('.map-canvas')).toHaveAttribute('data-map-instance',currentInstance);
 await expect(page.locator('.floating-detail')).toHaveCSS('width','440px');await page.screenshot({path:path.join(out,'wide-panel.png')});
 for(const [width,height] of [[1024,768],[375,900],[320,640],[844,390]]){
  await page.setViewportSize({width,height});await help.click();await expect(guide).toBeVisible();await page.screenshot({path:path.join(out,`guide-${width}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const box=await guide.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(height);
  await page.getByRole('button',{name:'건너뛰기',exact:true}).click();await expect(help).toBeFocused();
  await expect(page.getByRole('button',{name:'동네 찾기',exact:true})).toBeVisible();
  if(width===1024)await expect(page.locator('.floating-detail')).toHaveCSS('width','360px');
 }
 // Denied browser storage must not prevent entering or reopening the app.
 const blocked=await browser.newPage();await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError')};Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')};});
 blocked.on('pageerror',e=>errors.push(e.message));await blocked.goto(url);await expect(blocked.getByRole('dialog')).toBeVisible();await blocked.getByRole('button',{name:'사용법 닫기',exact:true}).click();await expect(blocked.getByRole('dialog')).not.toBeVisible();await blocked.getByRole('button',{name:'지도 사용법',exact:true}).click();await expect(blocked.getByRole('dialog')).toBeVisible();await blocked.close();
 expect(errors).toEqual([]);console.log('PASS: first visit, skip/Escape, repeat visit, manual help, focus containment/return, search/weather actions, selected region and map preservation, denied storage, wider left panel, mobile/landscape layouts.');
}catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await browser.close();}
