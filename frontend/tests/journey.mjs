import {chromium,expect} from '@playwright/test';
import {chooseNavigation} from './navigation.mjs';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(import.meta.dirname,'../../var/journey');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
if(!process.env.REAL_TILES)await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64')}));
const click=name=>chooseNavigation(page,name);
const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:path.join(out,name+'.png')});};
const search=async name=>{const input=page.getByRole('combobox',{name:'동네 이름 검색'});await input.fill(name);await expect(page.locator('.region-search-results [role=option]').first()).toBeVisible();await input.press('Enter');};
const api=async url=>(await page.request.get(new URL('/api'+url,page.url()).href)).json();
const sameRegion=code=>expect(page.locator('main')).toHaveAttribute('data-region',code);
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:3019');await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
 await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-ready','true');
 const instance=await page.locator('.map-canvas').getAttribute('data-map-instance');
 await expect(page.getByRole('button',{name:'태풍',exact:true})).toHaveCount(0);
 await click('재해 기록 선택');await expect(page.locator('.disaster-switch button')).toHaveCount(5);
 await expect(page.getByRole('button',{name:'폭염',exact:true})).toBeFocused();
 // Click trial verifies that the sibling workflow rail does not cover the popup.
 await page.getByRole('button',{name:'폭염',exact:true}).click({trial:true});
 await shot('02-picker');await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'재해 기록 선택'})).toBeFocused();
 await click('재해 기록 선택');await page.getByRole('combobox',{name:'동네 이름 검색'}).click();await expect(page.locator('.disaster-picker-popover')).toHaveCount(0);
 await search('우1동');await expect(page.locator('.regional-station')).toContainText('해운대');
 const code=await page.locator('main').getAttribute('data-region');
 const risk=await page.locator('.score-visual strong').innerText();
 await shot('01-overview');
 await page.getByRole('button',{name:/우1동의 쉼터·그늘막 확인/}).click();await sameRegion(code);
 await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue(code);
 const facilities=await api(`/facilities?region=${code}&kind=all&access=all`);
 await expect(page.locator('.facility-list-heading')).toContainText(`${facilities.facilities.length}개 등록 위치`);
 await expect(page.locator('.facility-heading')).toContainText('우1동');await shot('03-facilities');
 // Delay transport only, keeping the real response. Returning to the previous
 // region during an in-flight request must not leave an empty cached panel.
 const delayFacilities=async route=>{if(new URL(route.request().url()).searchParams.get('region')==='21110600')await new Promise(resolve=>setTimeout(resolve,2000));await route.continue().catch(()=>{});};
 await page.route('**/api/facilities?**',delayFacilities);
 await search('부곡4동');await expect(page.locator('.facility-loading')).toBeVisible();
 await search('우1동');await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue(code);
 await page.unroute('**/api/facilities?**',delayFacilities);
 await click('선택 동네의 기온 기록 확인');await sameRegion(code);
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue('937');
 await expect(page.locator('.timeline-dock input[type=range]')).toBeEnabled();
 await page.getByLabel('기상 관측소',{exact:true}).selectOption('940');await sameRegion(code);
 await page.getByRole('button',{name:/선택 동네의 쉼터·그늘막 확인/}).click();
 await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue(code);
 await click('동네 현황');await expect(page.locator('.score-visual strong')).toHaveText(risk);
 const profile=await api(`/disaster-profile/${code}?typhoon_id=2022-11`);
 await page.locator('.neighborhood-records>summary').click();
 await expect(page.getByRole('button',{name:'침수 기록 보기'})).toBeInViewport();
 await expect(page.getByRole('button',{name:'침수 기록 보기'})).toContainText(`${profile.hazards.flood.count}개 기록 지점`);
 await expect(page.getByRole('button',{name:'산사태 기록 보기'})).toContainText(`${profile.hazards.landslide.count}개 지정 지점`);
 await expect(page.getByRole('button',{name:'태풍 기록 보기'})).toContainText(`${profile.hazards.typhoon.year} ${profile.hazards.typhoon.name}`);
 if(profile.hazards.cold.minimum.value!=null)await expect(page.getByRole('button',{name:'한파 기록 보기'})).toContainText(profile.hazards.cold.minimum.value.toFixed(1));
 await shot('04-neighborhood-records');
 for(const [name,layer] of [['침수','flood'],['산사태','landslide'],['태풍','typhoon'],['한파','cold']]){
  const records=page.locator('.neighborhood-records');if(!await records.evaluate(el=>el.open))await records.locator('summary').click();
  await click(`${name} 기록 보기`);await sameRegion(code);
  await expect(page.locator('.map-canvas')).toHaveAttribute('data-layer',layer);
  await expect(page.locator('.map-canvas')).toHaveAttribute('data-map-instance',instance);
  await click('동네 현황으로');await sameRegion(code);await expect(page.locator('.score-visual strong')).toHaveText(risk);
 }
 // The shared scope follows searches inside each workflow, including cached weather.
 await click('기온 기록');await search('부곡4동');await sameRegion('21110600');
 const comparison=await api('/current-weather/comparison');
 const station=comparison.stations.find(s=>s.regions.some(r=>r.region_code==='21110600'));
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue(station.station_id);
 await expect(page.locator('.current-weather-panel')).toBeVisible();
 await click('쉼터·그늘막');await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue('21110600');
 await search('우1동');await sameRegion(code);await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue(code);
 await page.getByLabel('시설 읍면동',{exact:true}).selectOption({label:'우2동'});
 const other=await page.locator('main').getAttribute('data-region');expect(other).not.toBe(code);
 await expect(page.locator('.region-navigator-trigger')).toContainText('우2동');
 await click('기온 기록');await expect(page.locator('.weather-heading')).toContainText('우2동');
 await click('동네 현황');await expect(page.locator('.selected-region')).toContainText('우2동');
 // A region change in another disaster must also update facilities on return.
 await click('쉼터·그늘막');await click('침수');await search('부곡4동');await click('폭염');
 await expect(page.getByLabel('시설 읍면동',{exact:true})).toHaveValue('21110600');await sameRegion('21110600');
 await click('동네 현황');await expect(page.locator('.score-visual strong')).toHaveText('100.0');
 await expect(page.locator('.regional-weather')).toHaveCount(1);
 for(const width of [768,375]){
  await page.setViewportSize({width,height:900});await click('재해 기록 선택');
  await page.getByRole('button',{name:'태풍',exact:true}).click({trial:true});
  expect(await page.locator('.disaster-picker-popover>p').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await shot(`05-picker-${width}`);
  await page.keyboard.press('Escape');await click('쉼터·그늘막');
  await expect(page.locator('.facility-panel')).toBeVisible();await shot(`06-facilities-${width}`);
  await click('기온 기록');await expect(page.locator('.current-weather-panel')).toBeVisible();await shot(`07-weather-${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});await click('쉼터·그늘막');
 const count=requests.filter(u=>u.includes('/facilities?')).length;
 await click('지역 선택');await page.getByLabel('탐색 시·도',{exact:true}).selectOption('11');await click('선택 지역 보기');
 await sameRegion('11');await expect(page.locator('.region-coverage-empty')).toBeVisible();
 await expect(page.locator('.facility-panel')).toHaveCount(0);await expect(page.locator('.map-canvas')).toHaveAttribute('data-layer','base');
 expect(requests.filter(u=>u.includes('/facilities?')).length).toBe(count);
 await click('기온 기록');await expect(page.locator('.region-coverage-empty')).toBeVisible();await sameRegion('11');
 await click('쉼터·그늘막');await click('부산광역시 자료 보기');await sameRegion('21');
 await expect(page.locator('.facility-list-heading')).toContainText('3,569개 등록 위치');
 expect(errors).toEqual([]);
 console.log('PASS: collapsed hazards + keyboard/outside close, real neighborhood records, scoped facilities/weather roundtrips, unchanged score, shared map/region, cross-hazard scope changes, unsupported regions, responsive layouts.');
}catch(e){await shot('failure');fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());throw e;}finally{await browser.close();}
