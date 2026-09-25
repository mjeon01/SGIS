import {MapPin,ArrowRight} from 'lucide-react';
import type {Disaster} from '@/types/disasters';
import {LOCAL_DATA_AREAS} from './coverage';
import {DISASTERS} from './catalog';

export default function RegionCoverage({hazard,place,onRegion}:{hazard:Disaster;place:string;onRegion:(code:string)=>void}){
 const areas=LOCAL_DATA_AREAS[hazard],name=DISASTERS.find(item=>item.id===hazard)!.name;
 return <section className="region-coverage-empty" role="status"><span className="eyebrow">지역별 데이터 연결</span><MapPin size={26}/><h2>{place}<br/>{name} 자료 준비 중</h2><p>선택한 지역의 자료가 아직 연결되지 않았습니다. 지역을 유지한 채 지도를 탐색할 수 있습니다.</p><div><strong>현재 분석자료가 연결된 지역</strong>{areas.map(area=><button key={area.code} onClick={()=>onRegion(area.code)}>{area.name} 자료 보기<ArrowRight size={16}/></button>)}</div></section>;
}
