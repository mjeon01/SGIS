import {chromium,expect} from '@playwright/test';
import {chooseNavigation} from './navigation.mjs';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../var/weather-facilities-review');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
// Only road tiles are replaced. All observations and facilities come from the app's real API.
await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64')}));
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/facilities?'))requests.push(r.url());});
const choose=name=>chooseNavigation(page,name),api=async pathname=>(await page.request.get(new URL(pathname,page.url()).href)).json();
const shot=async name=>page.screenshot({path:path.join(output,name+'.png')});
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:3019');await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 const instance=await page.locator('.map-canvas').getAttribute('data-map-instance');
 await choose('기상 비교');await expect(page.getByLabel('선택 관측소 기온')).toBeVisible();
 const comparison=await api('/api/current-weather/comparison');
 const stationId=await page.getByLabel('기상 관측소',{exact:true}).inputValue();
 const station=comparison.stations.find(s=>s.station_id===stationId),daily=station.recent.daily;
 const latest=daily.at(-1),previous=daily.at(-2);
 await expect(page.locator('.observation-reading strong')).toHaveText(`${latest.maximum.toFixed(1)}℃`);
 await expect(page.locator('.observation-facts')).toContainText((latest.maximum-previous.maximum).toFixed(1));
 for(const day of daily){await expect(page.locator(`.timeline-data-strip i[data-date="${day.date}"]`)).toHaveAttribute('data-value',day.maximum==null?'':String(day.maximum));}
 const peak=daily.filter(d=>d.maximum!=null).reduce((a,b)=>b.maximum>a.maximum?b:a);
 await choose('기간 최고일');await expect(page.getByLabel('선택 관측소 기온')).toHaveAttribute('data-date',peak.date);
 await expect(page.locator('.observation-reading strong')).toHaveText(`${peak.maximum.toFixed(1)}℃`);
 await choose('관측소 위치');await page.waitForTimeout(350);
 const camera=JSON.parse(await page.locator('main').getAttribute('data-camera'));
 await choose('지도에 위치 찍고 가까운 3곳 찾기');await expect(page.locator('.weather-map canvas')).toBeFocused();
 await page.locator('.weather-map canvas').press('Enter');
 const results=page.getByLabel('가까운 시설 3곳').locator('button');await expect(results).toHaveCount(3);
 const facilities=await api('/api/facilities?region=21&kind=all&access=anyone');
 // Independent spherical-distance oracle over ALL city facilities, not just selected dong.
 const distance=f=>{const rad=Math.PI/180,lat=camera.latitude*rad,other=f.latitude*rad;return 6371.0088*Math.acos(Math.min(1,Math.max(-1,Math.sin(lat)*Math.sin(other)+Math.cos(lat)*Math.cos(other)*Math.cos((f.longitude-camera.longitude)*rad))));};
 const ranked=facilities.facilities.filter(f=>f.filter_status!=='unknown').map(f=>({...f,km:distance(f)})).sort((a,b)=>a.km-b.km||a.id.localeCompare(b.id));
 expect(await results.evaluateAll(els=>els.map(el=>el.dataset.id))).toEqual(ranked.slice(0,3).map(f=>f.id));
 for(let i=0;i<3;i++)expect(Number(await results.nth(i).getAttribute('data-distance'))).toBeCloseTo(ranked[i].km,5);
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-nearby-count',String(facilities.facilities.length));
 const selected=ranked[0];await results.first().click();await expect(page.getByLabel('선택한 주변 시설')).toContainText(selected.address);await expect(page.locator('.nearby-popup')).toContainText(selected.name);
 const marker=await page.getByRole('button',{name:`${station.station_name} 관측소 선택`,exact:true}).elementHandle();
 const requestCount=requests.length,region=await page.locator('main').getAttribute('data-region');
 const slider=page.getByRole('slider',{name:'관측 날짜'});await slider.focus();await slider.press('Home');await slider.press('ArrowRight');
 await expect(page.getByLabel('선택 관측소 기온')).toHaveAttribute('data-date',daily[1].date);
 expect(await marker.evaluate(el=>el.isConnected)).toBe(true);
 await expect(page.getByLabel('선택한 주변 시설')).toContainText(selected.name);
 await expect(page.locator('.nearby-anchor')).toHaveCount(1);expect(requests.length).toBe(requestCount);
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-map-instance',instance);await expect(page.locator('main')).toHaveAttribute('data-region',region);
 await page.locator('.nearby-filters summary').click();await expect(page.getByLabel('가까운 쉼터 이용대상')).toHaveValue('anyone');
 await page.getByLabel('가까운 쉼터 운영요일').selectOption('0');await page.getByLabel('가까운 쉼터 운영시간').fill('23:00');
 const filtered=await api('/api/facilities?region=21&kind=all&access=anyone&day=0&time=23%3A00');
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-nearby-count',String(filtered.facilities.length));
 await expect.poll(()=>results.evaluateAll(els=>els.map(el=>el.dataset.id))).toEqual(filtered.facilities.filter(f=>f.filter_status!=='unknown').sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id)).slice(0,3).map(f=>f.id));
 const unknown=filtered.facilities.filter(f=>f.filter_status==='unknown');
 if(unknown.length){await page.locator('.nearby-unknown summary').click();const ids=await page.locator('.nearby-unknown button').evaluateAll(els=>els.map(el=>el.dataset.id));expect(ids.every(id=>unknown.some(f=>f.id===id))).toBe(true);}
 await page.getByLabel('가까운 쉼터 운영요일').selectOption('');await expect(page.locator('.map-canvas')).toHaveAttribute('data-nearby-count',String(facilities.facilities.length));
 await page.getByLabel('기상 관측소',{exact:true}).selectOption('968');await expect(page.locator('.observation-reading strong')).toHaveText('—℃');await expect(page.getByLabel('선택 관측소 기온')).toContainText('비교 자료 없음');await expect(page.locator('.timeline-data-strip i:not(.is-missing)')).toHaveCount(0);
 await page.getByLabel('기상 관측소',{exact:true}).selectOption(stationId);
 for(const [width,height] of [[1024,768],[375,900],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  if(!(await page.locator('main').getAttribute('class')).includes('board-hidden'))await choose('지도 크게 보기');
  await shot(`map-${width}`);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const dock=await page.locator('.timeline-dock').boundingBox();expect(dock.x).toBeGreaterThanOrEqual(0);expect(dock.x+dock.width).toBeLessThanOrEqual(width);
  await choose('상세 함께 보기');await choose('기준 위치 바꾸기');if(width<=1000||height<=600)await expect(page.locator('main')).toHaveClass(/board-hidden/);
  const box=await page.locator('.weather-map canvas').boundingBox();await page.mouse.click(box.x+box.width*.55,box.y+box.height*.53);
  await expect(page.locator('.weather-map')).not.toHaveClass(/is-picking-location/);await expect(results).toHaveCount(3);await shot(`nearby-${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});await choose('지역 선택');await page.getByLabel('탐색 시·도').selectOption('11');await choose('선택 지역 보기');
 await expect(page.locator('main')).toHaveAttribute('data-region','11');await expect(page.locator('.nearby-anchor')).toHaveCount(0);await expect(page.locator('.map-canvas')).toHaveAttribute('data-nearby-count','0');await expect(page.locator('.map-canvas')).toHaveAttribute('data-layer','base');
 expect(errors).toEqual([]);console.log('PASS: actual daily temperature strip/peak/delta, real citywide nearest 3 distances, facility conditions, missing observations, persistent map/markers/anchor, cached playback, pointer/keyboard picking, mobile layouts, region coverage.');
}catch(error){await shot('failure');fs.writeFileSync(path.join(output,'failure.txt'),await page.locator('body').innerText());throw error;}finally{await browser.close();}
