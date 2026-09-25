'use client';
import {useEffect,useId,useRef} from 'react';
import {ArrowRight,Check,ChevronRight,CircleHelp,MapPin,Play,Search,Sun,Umbrella,X} from 'lucide-react';

const SEEN_KEY='climateguard:map-guide:v1';

/** Native modal keeps background controls inert and returns focus to the help button. */
export default function MapGuide({onWeather}:{onWeather:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const titleId=useId(),descriptionId=useId();
  useEffect(()=>{
    let seen=false;
    try{seen=localStorage.getItem(SEEN_KEY)==='seen';}catch{/* The guide remains usable when storage is blocked. */}
    if(!seen)dialog.current?.showModal();
    return()=>dialog.current?.close();
  },[]);
  const dismiss=()=>{
    try{localStorage.setItem(SEEN_KEY,'seen');}catch{/* Storage is optional. */}
    dialog.current?.close();
    trigger.current?.focus({preventScroll:true});
  };
  const start=(weather=false)=>{
    dismiss();
    if(weather)onWeather();
    requestAnimationFrame(()=>document.querySelector<HTMLElement>(weather?'.heat-journey button[aria-pressed="true"]':'.region-search input')?.focus({preventScroll:true}));
  };
  return <>
    <button ref={trigger} className="map-guide-trigger" aria-label="지도 사용법" aria-haspopup="dialog" title="지도 사용법" onClick={()=>dialog.current?.showModal()}><CircleHelp size={18} aria-hidden="true"/><span>사용법</span></button>
    <dialog ref={dialog} className="map-guide" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();dismiss();}} onKeyDown={e=>{
      if(e.key!=='Tab')return;
      const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button')),first=buttons[0],last=buttons.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }}>
      <div className="guide-topline"><span><MapPin size={15} aria-hidden="true"/>기후안심지도 시작하기</span><button className="guide-close" aria-label="사용법 닫기" onClick={dismiss}><X size={20} aria-hidden="true"/></button></div>
      <div className="guide-intro"><span className="guide-kicker">처음이라면, 이렇게 둘러보세요</span><h1 id={titleId}>우리 동네 기후 기록부터<br/>더위를 피할 곳까지</h1><p id={descriptionId}>궁금한 기능부터 골라보세요. 세 화면은 순서 없이 오갈 수 있어요.</p></div>
      <ul className="guide-steps">
        <li><div className="guide-step-visual guide-search" aria-hidden="true"><Search size={19}/><span>동네 이름 검색</span><i><Check size={14}/></i></div><div className="guide-step-copy"><h2>궁금한 동네 찾기</h2><p>상단 검색창에 동네 이름을 입력하고 검색 결과를 선택하세요.</p><small>동네의 기후·인구·주거 특성을 확인해요.</small></div></li>
        <li><div className="guide-step-visual guide-time" aria-hidden="true"><Sun size={20}/><span>기온 기록</span><ChevronRight size={15}/><Play size={16}/></div><div className="guide-step-copy"><h2>얼마나 더웠는지 보기</h2><p>‘기온 기록’을 누르고 하단 타임라인에서 날짜를 바꿔보세요.</p><small>관측소의 최고·최저기온을 비교해요.</small></div></li>
        <li><div className="guide-step-visual guide-facility" aria-hidden="true"><MapPin size={20}/><span>내가 고른 위치</span><ChevronRight size={15}/><Umbrella size={20}/></div><div className="guide-step-copy"><h2>가까운 곳에서 쉬기</h2><p>기온 기록 화면에서 ‘지도에 위치 찍고 가까운 3곳 찾기’를 눌러보세요.</p><small>쉼터·그늘막의 거리와 이용조건을 확인해요.</small></div></li>
      </ul>
      <div className="guide-more"><CircleHelp size={17} aria-hidden="true"/><p><strong>다른 재해도 궁금하다면</strong> 지도 상단의 ‘재해 변경’에서 침수·산사태·태풍·한파 기록을 살펴보세요.</p></div>
      <p className="guide-coverage">기온·시설은 현재 부산 수집자료로 안내해요. 시설 거리는 직선거리이며, 지역별 자료 범위는 달라요.</p>
      <div className="guide-actions"><button className="guide-primary" onClick={()=>start()}>동네 찾으며 시작<ArrowRight size={17} aria-hidden="true"/></button><button className="guide-secondary" onClick={()=>start(true)}>기온 기록 먼저 보기</button><button className="guide-skip" onClick={dismiss}>건너뛰기</button></div>
      <p className="guide-return">다음 방문부터 자동으로 열리지 않아요. 상단 <CircleHelp size={13} aria-hidden="true"/> <b>사용법</b>에서 다시 볼 수 있어요.</p>
    </dialog>
  </>;
}
