import {chooseNavigation} from './navigation.mjs';
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../var/timeline-review');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles'});
// Time/navigation checks use real observations, without repeatedly fetching road tiles.
await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64')}));
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
const choose=name=>chooseNavigation(page,name);
const time=()=>page.locator('.timeline-heading time').getAttribute('datetime');
const shot=async name=>{await page.waitForTimeout(350);await page.screenshot({path:path.join(output,name+'.png')});};
const search=async name=>{await page.getByRole('combobox',{name:'동네 이름 검색'}).fill(name);await page.getByRole('combobox',{name:'동네 이름 검색'}).press('Enter');};
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:3019');await page.getByRole('button',{name:'건너뛰기',exact:true}).click();await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 await search('부곡4동');await choose('태풍');await expect(page.locator('.typhoon-closest')).toContainText('10.1');
 const track=await(await page.request.get(new URL('/api/typhoons/2022-11?region=21110600',page.url()).href)).json();
 await choose('전체 태풍 경로 보기');await page.waitForTimeout(650);
 const slider=page.getByRole('slider',{name:'관측 시각'}),points=track.storm.points;
 const before=requests.filter(u=>u.includes('/typhoons/')).length;
 await slider.focus();await slider.press('Home');await expect(page.locator('.timeline-heading time')).toHaveAttribute('datetime',points[0].timestamp);
 await slider.press('ArrowRight');await expect(page.locator('.timeline-heading time')).toHaveAttribute('datetime',points[1].timestamp);
 const min=Number(await slider.getAttribute('min')),max=Number(await slider.getAttribute('max'));
 expect(min).toBe(Date.parse(points[0].timestamp));expect(max).toBe(Date.parse(points.at(-1).timestamp));
 const box=await slider.boundingBox();await page.mouse.click(box.x+box.width*.42,box.y+30);
 const current=await time();expect(points.some(p=>p.timestamp===current)).toBe(true);
 const position=await page.locator('.timeline-playhead').evaluate(el=>parseFloat(el.style.left));expect(position).toBeCloseTo(100*(Date.parse(current)-min)/(max-min),4);
 await choose('최근접 기록');await expect(page.locator('.timeline-heading time')).toHaveAttribute('datetime',track.closest.timestamp);
 await expect(page.locator('.timeline-heading time')).toContainText('2022.09.06');await expect(page.locator('.timeline-heading time')).toContainText('06:00');
 await shot('01-desktop-typhoon');
 await choose('날짜 바로 선택');await expect(page.getByLabel('타임라인 날짜 선택')).toBeFocused();
 await page.getByLabel('타임라인 날짜 선택').fill('2022-09-05');await expect(page.locator('.timeline-heading time')).toHaveAttribute('datetime',points.find(p=>p.timestamp.startsWith('2022-09-05')).timestamp);
 await page.getByLabel('타임라인 날짜 선택').press('Escape');await expect(page.getByRole('button',{name:'날짜 바로 선택'})).toBeFocused();
 await page.getByLabel('재생 속도').selectOption('4');await slider.focus();await slider.press('End');await choose('재생');
 await expect(page.locator('.timeline-heading time')).not.toHaveAttribute('datetime',points.at(-1).timestamp);await choose('일시정지');
 const paused=await time();await page.waitForTimeout(600);expect(await time()).toBe(paused);
 expect(requests.filter(u=>u.includes('/typhoons/')).length).toBe(before);
 await choose('한파');await expect(page.getByRole('slider',{name:'관측 날짜'})).toBeEnabled();
 await choose('겨울 최저일');const lowest=await page.getByLabel('겨울 관측 날짜').inputValue();expect(await time()).toBe(lowest);await shot('02-desktop-winter');
 await page.getByRole('slider',{name:'관측 날짜'}).press('End');await expect(page.getByRole('button',{name:'다음 날짜',exact:true})).toBeDisabled();await choose('재생');await expect(page.locator('.timeline-heading time')).not.toHaveAttribute('datetime','2026-02-28');await choose('일시정지');
 // Region selection is shared across hazards; uncollected regions never inherit Busan observations.
 await choose('지역 선택');await expect(page.getByLabel('탐색 시·도')).toBeFocused();
 await page.getByLabel('탐색 시·도').selectOption('11');await choose('선택 지역 보기');await expect(page.locator('main')).toHaveAttribute('data-region','11');
 await expect(page.locator('.region-coverage-empty')).toContainText('서울특별시');await expect(page.locator('.map-canvas')).toHaveAttribute('data-layer','base');
 await expect(page.locator('.map-timeline input[type=range]')).toBeDisabled();await shot('03-national-coverage');
 for(const name of ['침수','산사태']){await choose(name);await expect(page.locator('main')).toHaveAttribute('data-region','11');await expect(page.locator('.region-coverage-empty')).toContainText('자료 준비 중');await expect(page.locator('.map-canvas')).toHaveAttribute('data-layer','base');}
 await choose('태풍');await expect(page.locator('.timeline-scale')).toBeVisible();await expect(page.locator('.map-story-card')).not.toContainText('km');
 await search('부곡4동');await expect(page.locator('main')).toHaveAttribute('data-region','21110600');await expect(page.locator('.typhoon-closest')).toContainText('10.1');
 for(const [width,height] of [[1024,768],[768,1024],[375,900]]){
  await page.setViewportSize({width,height});await page.locator('.disaster-primary').click();await page.waitForTimeout(650);await choose('일시정지');
  await shot(`04-timeline-${width}`);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const dock=await page.locator('.timeline-dock').boundingBox(),ruler=await page.locator('.timeline-scale').boundingBox();expect(dock.x).toBeGreaterThanOrEqual(0);expect(dock.x+dock.width).toBeLessThanOrEqual(width);expect(ruler.width).toBeGreaterThan(80);
  if(width<=760){await expect(page.locator('main')).toHaveClass(/board-hidden/);await choose('지역 선택');await expect(page.getByLabel('탐색 시·도')).toBeVisible();await shot('05-mobile-regions');await choose('지역 선택 닫기');}
  if(await page.locator('main').evaluate(el=>el.classList.contains('board-hidden')))await choose('데이터보드 표시 전환');
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:844,height:390});await choose('데이터보드 표시 전환');await shot('06-landscape');
 expect(errors).toEqual([]);console.log('PASS: actual-time ruler, KST independent of browser timezone, pointer/keyboard/calendar seeking, replay + speed + pause, cached observations, nationwide selection + honest coverage, responsive layouts.');
}catch(error){await shot('failure');fs.writeFileSync(path.join(output,'failure.txt'),await page.locator('body').innerText());throw error;}finally{await browser.close();}
