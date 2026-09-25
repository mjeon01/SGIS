import {chooseNavigation} from './navigation.mjs';
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../var/usability');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];let tiles=0;page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('tile.openstreetmap.org')&&r.status()===200)tiles++;});
const choose=name=>chooseNavigation(page,name);
const shot=async name=>page.screenshot({path:path.join(output,name+'.png')});
const visiblePoint=async()=>{
 const marker=await page.locator('.typhoon-position').boundingBox(),panel=await page.locator('.floating-detail').boundingBox(),timeline=await page.locator('.timeline-dock').boundingBox();
 const viewport=page.viewportSize();expect(marker).not.toBeNull();expect(marker.x).toBeGreaterThan(viewport.width>760&&panel?panel.x+panel.width:0);
 expect(marker.x+marker.width).toBeLessThan(viewport.width);expect(marker.y).toBeGreaterThan(150);expect(marker.y+marker.height).toBeLessThan(timeline.y);
 if(viewport.width<=760){
  const legend=await page.locator('.disaster-legend').boundingBox(),label=await page.locator('.typhoon-position-label').boundingBox();
  if(legend&&label)expect(label.y+label.height).toBeLessThan(legend.y);
 }
};
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:3019');await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
 await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 await page.getByRole('combobox',{name:'동네 이름 검색'}).fill('부곡4동');await page.getByRole('combobox',{name:'동네 이름 검색'}).press('Enter');
 await choose('태풍');await expect(page.locator('.typhoon-closest')).toContainText('10.1');
 const panel=await page.locator('.floating-detail').boundingBox();expect(panel.x).toBe(16);
 await expect(page.locator('.disaster-primary')).toBeInViewport();
 await page.locator('.disaster-primary').click();await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
 await page.waitForTimeout(700);await visiblePoint();
 const first=await page.locator('.timeline-heading time').getAttribute('datetime');
 await expect(page.locator('.timeline-heading time')).not.toHaveAttribute('datetime',first,{timeout:3000});
 await visiblePoint();await choose('일시정지');await page.waitForTimeout(400);
 await expect.poll(()=>tiles,{timeout:20000}).toBeGreaterThan(0);
 await shot('01-typhoon-approach');
 await choose('최근접 시각 보기');await page.waitForTimeout(700);await visiblePoint();await shot('02-neighborhood-distance');
 await page.locator('.disaster-primary').click();await choose('최근접 시각 보기');
 await expect(page.getByRole('button',{name:'재생',exact:true})).toBeVisible();
 const paused=await page.locator('.timeline-heading time').getAttribute('datetime');await page.waitForTimeout(1200);await expect(page.locator('.timeline-heading time')).toHaveAttribute('datetime',paused);
 await choose('한파');await choose('태풍');await expect(page.getByRole('button',{name:'일시정지',exact:true})).toHaveCount(0);
 // Empty local designations explain the limit and offer a broader, explicit region.
 await choose('산사태');await expect(page.locator('.map-timeline')).toHaveCount(0);
 await choose('부산 전체 보기');await expect(page.locator('.landslide-list>button')).toHaveCount(358);
 await page.locator('.disaster-primary').click();await page.waitForTimeout(700);await shot('03-designated-locations');
 await page.locator('.landslide-list>button').first().click();await page.waitForTimeout(700);
 await expect(page.locator('.landslide-detail>h3')).toBeInViewport();await expect(page.locator('.neighborhood-glance')).toContainText('생활환경');
 const pin=await page.locator('.landslide-map-label').boundingBox();expect(pin.x).toBeGreaterThan(panel.x+panel.width);
 await shot('04-location-and-neighborhood');
 await choose('태풍');await expect(page.locator('.disaster-primary')).toBeInViewport();
 await page.setViewportSize({width:375,height:900});await page.waitForTimeout(300);
 await expect(page.locator('.disaster-primary')).toBeInViewport();await shot('05-mobile-summary');
 await page.locator('.disaster-primary').click();await page.waitForTimeout(700);
 await expect(page.locator('main')).toHaveClass(/board-hidden/);await visiblePoint();await shot('06-mobile-playback');
 await choose('일시정지');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
 await page.emulateMedia({reducedMotion:'reduce'});await choose('데이터보드 표시 전환');await choose('최근접 시각 보기');await visiblePoint();
 expect(errors).toEqual([]);console.log(`PASS: left panel, visible primary actions, actual OSM tiles (${tiles}), framed playback, selected point + neighborhood, mobile map reveal, no autoplay on return, reduced motion.`);
}catch(e){await shot('failure');fs.writeFileSync(path.join(output,'failure.txt'),await page.locator('body').innerText());throw e;}finally{await browser.close();}
