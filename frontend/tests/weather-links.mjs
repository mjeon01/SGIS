import {chooseNavigation} from './navigation.mjs';
import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
fs.mkdirSync(path.join(root,'var/regression-screenshots'),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>{await page.waitForTimeout(550);await page.screenshot({path:path.join(root,'var/regression-screenshots',name+'.png'),fullPage:true});};
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:3018');await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
 await expect(page.locator('.map-statusbar')).toContainText('173개 종합점수',{timeout:30000});
 const comparison=await(await page.request.get(new URL('/api/current-weather/comparison',page.url()).href)).json();
 await page.getByRole('combobox',{name:'동네 이름 검색'}).fill('우1동');
 await page.getByRole('combobox',{name:'동네 이름 검색'}).press('Enter');
 await expect(page.locator('.regional-station')).toContainText('해운대');
 const riskBefore=await page.locator('.score-visual strong').innerText();
 await page.getByRole('button',{name:'최근 기온을 지도에서 비교'}).click();
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue('937');
 await expect(page.locator('.weather-linked-regions')).toContainText('해운대 관측소 인근 동네');
 await expect(page.locator('.weather-return-analysis')).toContainText('우1동');
 await expect(page.locator('.weather-comparison-list')).toContainText(comparison.observed_on);
 await expect(page.locator('.weather-map')).toHaveAttribute('data-ready','true');
 for(const station of comparison.stations.filter(s=>s.location)){
  await expect(page.getByRole('button',{name:`${station.station_name} 관측소 선택`,exact:true})).toContainText(station.maximum==null?'관측 없음':`${station.maximum.toFixed(1)}℃`);
 }
 await shot('43-same-day-weather-comparison');
 // The shared map preserves the selected dong's zoom; zoom out to compare stations.
 await page.getByRole('button',{name:'지도 축소',exact:true}).click();await page.waitForTimeout(300);
 await page.getByRole('button',{name:'지도 축소',exact:true}).click();await page.waitForTimeout(300);
 await page.getByRole('button',{name:'동래 관측소 선택',exact:true}).click();
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue('940');
 await expect(page.locator('.weather-linked-regions')).toContainText('동래 관측소 인근 동네');
 const first=comparison.stations.find(s=>s.station_id==='940').regions[0];
 await shot('44-weather-linked-neighborhoods');
 await page.locator('.weather-linked-list button').first().click();
 await expect(page.locator('.selected-region')).toContainText(first.region_name);
 await expect(page.locator('.regional-station')).toContainText('동래');
 await expect(page.getByRole('tab',{name:'위험현황',exact:true,includeHidden:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.analysis-weather-back')).toBeVisible();
 await shot('45-weather-to-neighborhood-analysis');
 await page.getByRole('button',{name:'기상 비교 지도로 돌아가기',exact:false}).click();
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue('940');
 await page.getByLabel('기상 관측소',{exact:true}).selectOption('968');
 await expect(page.locator('.weather-latest')).toContainText('미확인');
 await expect(page.locator('.weather-linked-regions')).toContainText('현재 연결된 부산 읍·면·동이 없습니다.');
 await page.getByRole('button',{name:`${first.region_name} 분석으로 돌아가기`,exact:false}).click();
 await expect(page.locator('.selected-region')).toContainText(first.region_name);
 await chooseNavigation(page,'지역 탐색');
 await page.getByRole('combobox',{name:'동네 이름 검색'}).fill('우1동');await page.getByRole('combobox',{name:'동네 이름 검색'}).press('Enter');
 await expect(page.locator('.score-visual strong')).toHaveText(riskBefore);
 await chooseNavigation(page,'기상 비교');
 await expect(page.getByLabel('기상 관측소',{exact:true})).toHaveValue('937');
 expect(errors).toEqual([]);
 console.log('PASS: same-day station values, linked dong analysis, station/region roundtrips, missing observations, unchanged vulnerability score. 3 screenshots.');
}catch(e){await page.screenshot({path:path.join(root,'var/weather-links-failure.png'),fullPage:true});throw e;}finally{await browser.close();}
