/** Korea time regardless of browser timezone; no observation interpolation. */
const DAY=86400000;
function timestamp(value:string) {return Date.parse(value.length===10?`${value}T00:00:00+09:00`:value);}
export function timeLabel(value:string,hourly:boolean,kind:'full'|'tick'|'subtick'|'cursor') {
  if(!value)return '';
  const date=new Date(timestamp(value)+9*3600000);
  if(!Number.isFinite(date.getTime()))return value;
  const month=date.getUTCMonth()+1,day=date.getUTCDate(),weekday=['일','월','화','수','목','금','토'][date.getUTCDay()];
  const time=`${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')}`;
  if(kind==='full')return `${date.getUTCFullYear()}.${String(month).padStart(2,'0')}.${String(day).padStart(2,'0')} (${weekday})${hourly?` ${time}`:''}`;
  if(kind==='tick')return `${month}.${day}`;
  if(kind==='subtick')return hourly?time:weekday;
  return hourly?`${month}.${day} ${time}`:`${month}.${day} (${weekday})`;
}
export function timelineScale(steps:string[],width:number,hourly:boolean) {
  const times=steps.map(timestamp),start=times[0]||0,end=times.at(-1)||start+DAY;
  const position=(index:number)=>times.length<2?0:100*(times[index]-start)/Math.max(1,end-start);
  const nearest=(time:number)=>{
    let low=0,high=times.length-1;
    while(low<high){const mid=Math.floor((low+high)/2);if(times[mid]<time)low=mid+1;else high=mid;}
    return low>0&&Math.abs(times[low-1]-time)<=Math.abs(times[low]-time)?low-1:low;
  };
  const count=Math.max(2,Math.floor(width/(hourly?85:70)));
  const ticks=Array.from(new Set(Array.from({length:count},(_,i)=>nearest(start+(end-start)*i/(count-1)))));
  const stride=Math.max(1,Math.ceil(times.length/Math.max(2,Math.floor(width/9))));
  const minor=times.map((_,i)=>i).filter(i=>i%stride===0&&!ticks.includes(i));
  return {times,start,end,position,nearest,ticks,minor};
}
