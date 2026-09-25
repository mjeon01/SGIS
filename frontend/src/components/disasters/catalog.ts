import {Mountain, Snowflake, Sun, Waves, Wind} from 'lucide-react';
import type {Disaster, PendingDisaster} from '@/types/disasters';

export const DISASTERS = [
  {id:'heat', name:'폭염', icon:Sun},
  {id:'flood', name:'침수', icon:Waves},
  {id:'landslide', name:'산사태', icon:Mountain},
  {id:'typhoon', name:'태풍', icon:Wind},
  {id:'cold', name:'한파', icon:Snowflake},
] as const;
export function isPendingDisaster(value:Disaster):value is PendingDisaster {
  return value === 'landslide' || value === 'typhoon' || value === 'cold';
}
export const PENDING_MESSAGES:Record<PendingDisaster,string> = {
  landslide:'산사태 취약지역 데이터가 아직 연결되지 않았습니다.',
  typhoon:'과거 태풍 경로 데이터가 아직 연결되지 않았습니다.',
  cold:'겨울 기온 데이터가 아직 연결되지 않았습니다.',
};
