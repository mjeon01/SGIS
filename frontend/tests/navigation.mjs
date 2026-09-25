// Shared user navigation after the place-first shell change.
export async function chooseNavigation(page,name) {
 if(['폭염','침수','산사태','태풍','한파'].includes(name)) {
  await page.getByRole('button',{name:'재해 기록 선택',exact:true}).click();
 } else if(name==='지역 탐색' && !await page.locator('.floating-detail').isVisible()) {
  await page.getByRole('button',{name:'데이터보드 표시 전환',exact:true}).click();
 }
 const labels={'동네 분석':'동네 현황','현재 시설':'쉼터·그늘막','기상 비교':'기온 기록'};
 await page.getByRole('button',{name:labels[name]||name,exact:true}).click();
}
export async function selectAnalysisTab(page,name) {
 const options=page.locator('.analysis-options');
 if(!await options.evaluate(el=>el.open))await options.locator('summary').click();
 await page.getByRole('tab',{name,exact:true}).click();
}
