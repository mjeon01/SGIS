'use client';
import {useEffect, useId, useMemo, useRef, useState} from 'react';
import type {CSSProperties, KeyboardEvent} from 'react';
import {CalendarDays, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X} from 'lucide-react';
import {timelineScale, timeLabel} from './timeline-scale';

type Props = {
  title:string; steps:string[]; value:string; onChange:(value:string)=>void;
  disabledReason?:string; hourly?:boolean; playRequest?:number; pauseRequest?:number;
  resetToken?:string; onPlay?:()=>void; caption?:string; context?:string;
  highlight?:{value:string; label:string; onSelect?:()=>void};
};

/** Shared time control; only stored observations are selectable. */
export default function Timeline({title,steps,value,onChange,disabledReason,hourly=false,playRequest=0,pauseRequest=0,resetToken,onPlay,caption,context,highlight}:Props) {
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const [calendar,setCalendar]=useState(false),[hover,setHover]=useState<number|null>(null),[width,setWidth]=useState(600);
  const scaleRef=useRef<HTMLDivElement>(null),dateRef=useRef<HTMLInputElement>(null),calendarButton=useRef<HTMLButtonElement>(null);
  const id=useId(),consumedPlay=useRef(playRequest);
  const scale=useMemo(()=>timelineScale(steps,width,hourly),[steps,width,hourly]);
  const index=Math.max(0,steps.indexOf(value)),last=index>=steps.length-1;
  const disabled=!!disabledReason||steps.length<2;
  const selected=steps[index]||'',percent=scale.position(index);
  const highlightIndex=highlight?steps.indexOf(highlight.value):-1;
  useEffect(()=>{
    const element=scaleRef.current;if(!element)return;
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));
    observer.observe(element);return()=>observer.disconnect();
  },[disabled]);
  useEffect(()=>{setPlaying(false);setCalendar(false);setHover(null);},[resetToken,pauseRequest]);
  useEffect(()=>{if(playRequest!==consumedPlay.current){consumedPlay.current=playRequest;setPlaying(true);}},[playRequest]);
  useEffect(()=>{
    if(!playing||disabled||last)return;
    const timer=setTimeout(()=>onChange(steps[index+1]),1000/speed);
    return()=>clearTimeout(timer);
  },[playing,disabled,last,index,steps,onChange,speed]);
  useEffect(()=>{if(disabled||last)setPlaying(false);},[disabled,last]);
  useEffect(()=>{
    const stop=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',stop);
    return()=>document.removeEventListener('visibilitychange',stop);
  },[]);
  useEffect(()=>{if(calendar)dateRef.current?.focus();},[calendar]);
  const move=(next:number)=>{setPlaying(false);setHover(null);if(steps[next])onChange(steps[next]);};
  const play=()=>{if(playing){setPlaying(false);return;}if(last)onChange(steps[0]);onPlay?.();setPlaying(true);};
  const closeCalendar=()=>{setCalendar(false);calendarButton.current?.focus();};
  const keyMove=(event:KeyboardEvent<HTMLInputElement>)=>{
    const next=event.key==='Home'?0:event.key==='End'?steps.length-1:
      ['ArrowRight','ArrowUp'].includes(event.key)?index+1:['ArrowLeft','ArrowDown'].includes(event.key)?index-1:
      event.key==='PageUp'?index+7:event.key==='PageDown'?index-7:null;
    if(next!=null){event.preventDefault();move(Math.max(0,Math.min(steps.length-1,next)));}
    if(event.key===' '){event.preventDefault();play();}
  };
  return <section className={`map-timeline ${disabled?'is-disabled':''} ${playing?'is-playing':''}`} aria-label={title} data-resolution={hourly?'hourly':'daily'}>
    <div className="timeline-heading">
      <div className="timeline-title"><span className="timeline-status-dot"/><strong>{title}</strong>{context&&<span className="timeline-context" title={context}>{context}</span>}</div>
      <div className="timeline-date-control"><span className="timeline-record-badge">과거 기록</span><time dateTime={value}>{disabled?'시간 탐색 대기':timeLabel(selected,hourly,'full')}</time>{!disabled&&<><span className="timeline-timezone">KST</span><button ref={calendarButton} className="timeline-calendar-toggle" aria-label="날짜 바로 선택" aria-expanded={calendar} aria-controls={`${id}-calendar`} onClick={()=>{setPlaying(false);setCalendar(v=>!v);}}><CalendarDays size={17}/></button></>}</div>
    </div>
    {disabled?<div className="timeline-unavailable"><Play size={18} aria-hidden="true"/><p id={id}>{disabledReason||'시간을 비교할 관측기록이 부족합니다.'}</p><input type="range" aria-label={hourly?'관측 시각':'관측 날짜'} disabled aria-describedby={id} min={0} max={1} value={0} readOnly/></div>:<>
      <div className="timeline-main">
        <div className="timeline-transport">
          <button aria-label={hourly?'이전 시각':'이전 날짜'} disabled={index===0} onClick={()=>move(index-1)}><ChevronLeft size={18}/></button>
          <button className="timeline-play" aria-label={playing?'일시정지':'재생'} title={last?'처음부터 다시 재생':undefined} onClick={play}>{playing?<Pause size={19}/>:last?<RotateCcw size={19}/>:<Play size={19}/>}<span>{playing?'일시정지':last?'다시 재생':'재생'}</span></button>
          <button aria-label={hourly?'다음 시각':'다음 날짜'} disabled={last} onClick={()=>move(index+1)}><ChevronRight size={18}/></button>
        </div>
        <div ref={scaleRef} className="timeline-scale" style={{'--progress':`${percent}%`} as CSSProperties}>
          <div className="timeline-ruler" aria-hidden="true">
            <div className="timeline-elapsed"/>
            {scale.minor.map(tick=><i key={tick} className="timeline-minor-tick" style={{left:`${scale.position(tick)}%`}}/>)}
            {scale.ticks.map((tick,i)=><span key={tick} className={`timeline-tick ${i===0?'is-first':i===scale.ticks.length-1?'is-last':''}`} style={{left:`${scale.position(tick)}%`}}><i/><span>{timeLabel(steps[tick],hourly,'tick')}</span><small>{timeLabel(steps[tick],hourly,'subtick')}</small></span>)}
            {highlightIndex>=0&&<i className="timeline-highlight-mark" style={{left:`${scale.position(highlightIndex)}%`}} title={highlight?.label}/>}
            <div className="timeline-playhead" style={{left:`${percent}%`}}><span style={{transform:`translateX(-${percent}%)`}}>{timeLabel(selected,hourly,'cursor')}</span><i/></div>
            {hover!=null&&hover!==index&&<div className="timeline-hover" style={{left:`${scale.position(hover)}%`,transform:`translateX(-${scale.position(hover)}%)`}}>{timeLabel(steps[hover],hourly,'cursor')}</div>}
          </div>
          <input type="range" aria-label={hourly?'관측 시각':'관측 날짜'} aria-valuetext={timeLabel(selected,hourly,'full')+' 한국시간'} min={scale.start} max={scale.end} step={1} value={scale.times[index]??scale.start}
            onKeyDown={keyMove} onChange={e=>move(scale.nearest(Number(e.target.value)))}
            onPointerDown={()=>{setPlaying(false);setHover(null);}} onPointerLeave={()=>setHover(null)}
            onPointerMove={e=>{if(e.pointerType!=='mouse'||e.buttons)return;const box=e.currentTarget.getBoundingClientRect();setHover(scale.nearest(scale.start+Math.max(0,Math.min(1,(e.clientX-box.left)/box.width))*(scale.end-scale.start)));}}/>
        </div>
      </div>
      <div className="timeline-footer"><span className="timeline-caption">{caption||(hourly?'기록된 시각의 태풍 위치':'일별 관측기록')}<span className="timeline-record-count"> · {steps.length}개 기록</span></span><div className="timeline-options">
        {highlightIndex>=0&&<button className="timeline-highlight-button" onClick={()=>{move(highlightIndex);highlight?.onSelect?.();}}><i/>{highlight?.label}</button>}
        <label className="timeline-speed"><span>속도</span><select aria-label="재생 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n=><option key={n} value={n}>{n}×</option>)}</select></label>
      </div></div>
    </>}
    {calendar&&!disabled&&<div id={`${id}-calendar`} className="timeline-calendar" role="group" aria-label="날짜 바로 이동" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeCalendar();}}}>
      <div><strong>기록 날짜로 이동</strong><button aria-label="날짜 선택 닫기" onClick={closeCalendar}><X size={16}/></button></div>
      <label>관측 날짜<input ref={dateRef} type="date" aria-label="타임라인 날짜 선택" min={steps[0].slice(0,10)} max={steps.at(-1)!.slice(0,10)} value={selected.slice(0,10)} onChange={e=>{if(!e.target.value)return;const found=steps.findIndex(t=>t.startsWith(e.target.value));if(found>=0)move(found);}}/></label>
      {hourly&&<label>기록 시각<select aria-label="타임라인 시각 선택" value={selected} onChange={e=>move(steps.indexOf(e.target.value))}>{steps.filter(t=>t.startsWith(selected.slice(0,10))).map(t=><option key={t} value={t}>{timeLabel(t,true,'cursor')}</option>)}</select></label>}
      <p>저장된 관측기록으로 이동합니다.</p><button className="timeline-calendar-done" onClick={closeCalendar}>지도에서 보기</button>
    </div>}
  </section>;
}
