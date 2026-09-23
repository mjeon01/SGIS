import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'../..');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const messages=[];
page.on('console',m=>{if(['warning','error'].includes(m.type()))messages.push(m.text());});
page.on('pageerror',e=>messages.push(e.message));
await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64')}));
try{
 await page.goto('http://127.0.0.1:3018');
 await page.getByRole('button',{name:'침수',exact:true}).click();
 await expect(page.locator('.flood-count strong')).toHaveText('186건');
 await page.getByRole('button',{name:'행정경계',exact:true}).click();
 await page.getByRole('tab',{name:'침수 예상도',exact:true}).click();
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-flood-layer','forecast');
 await page.getByRole('tab',{name:'과거 침수 이력',exact:true}).click();
 await page.getByRole('tab',{name:'침수 예상도',exact:true}).click();
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-flood-layer','forecast');
 await page.getByRole('tab',{name:'침수 예상도',exact:true}).click();
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-flood-layer','forecast');
 await page.waitForTimeout(2500);
 const pixels=await sharp(await page.locator('.map-canvas').screenshot()).ensureAlpha().raw().toBuffer();
 let colored=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+2]-pixels[i]>45&&pixels[i+2]>150)colored++;}
 expect(colored).toBeGreaterThan(100);
 await page.screenshot({path:path.join(root,'var/flood-browser.png')});
 expect(messages.filter(m=>!m.includes('GPU stall'))).toEqual([]);
 console.log(`PASS: forecast raster contains ${colored} blue/cyan map pixels, transparent background and no browser errors.`);
}finally{await browser.close();}
