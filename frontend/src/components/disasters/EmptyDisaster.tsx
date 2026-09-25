import type {PendingDisaster} from '@/types/disasters';
import {DISASTERS, PENDING_MESSAGES} from './catalog';

export default function EmptyDisaster({hazard,place,loading=false,error,onRetry}:{hazard:PendingDisaster;place:string;loading?:boolean;error?:string|null;onRetry?:()=>void}) {
  const item=DISASTERS.find(item=>item.id===hazard)!;
  const Icon=item.icon;
  return <section className="disaster-empty" role="status" aria-live="polite" data-hazard={hazard}>
    <div className="empty-disaster-icon"><Icon size={28} aria-hidden="true"/></div>
    <span className="eyebrow">{place} · {item.name}</span>
    <h1>{loading?'자료 확인 중':'데이터 준비 중'}</h1><p>{loading?'저장된 공식 자료를 불러오고 있습니다.':error||PENDING_MESSAGES[hazard]}</p>
    {error&&onRetry&&<button className="text-button" onClick={onRetry}>다시 불러오기</button>}
    <small>선택한 지역의 경계와 배경지도를 살펴볼 수 있습니다.</small>
  </section>;
}
