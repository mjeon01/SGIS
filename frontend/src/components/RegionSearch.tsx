'use client';
import {useId, useMemo, useRef, useState} from 'react';
import {Search, X, MapPin} from 'lucide-react';

export type SearchRegion = {region_code:string; region_name:string; full_name?:string};
export default function RegionSearch({regions,onSelect}:{regions:SearchRegion[];onSelect:(code:string)=>void}) {
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const input=useRef<HTMLInputElement>(null);
  const id=useId();
  const results=useMemo(()=>query.trim()?regions.filter(r=>(r.full_name||r.region_name).replaceAll(' ','').includes(query.replaceAll(' ',''))).slice(0,12):[],[regions,query]);
  const choose=(code:string)=>{onSelect(code);setQuery('');setOpen(false);setActive(-1);};
  return <div className="region-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <Search size={17}/><input ref={input} role="combobox" aria-label="동네 이름 검색" aria-autocomplete="list" aria-expanded={open&&!!query} aria-controls={id} aria-activedescendant={active>=0?`${id}-${active}`:undefined} placeholder="동네 이름으로 바로 찾기" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(-1);}} onKeyDown={e=>{
      if(e.key==='Escape'){setOpen(false);setActive(-1);}
      else if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,results.length-1));}
      else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0));}
      else if(e.key==='Enter'&&open&&results.length){e.preventDefault();choose(results[Math.max(0,active)].region_code);}
    }}/>{query&&<button aria-label="검색어 지우기" onClick={()=>{setQuery('');input.current?.focus();}}><X size={15}/></button>}
    {open&&query&&<div className="region-search-results" id={id} role="listbox" aria-label="동네 검색 결과">{results.length?results.map((r,i)=><button key={r.region_code} id={`${id}-${i}`} role="option" aria-selected={active===i} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(r.region_code)}><MapPin size={15}/><span><b>{r.region_name}</b><small>{r.full_name||'부산광역시'}</small></span></button>):<p>일치하는 부산 지역이 없습니다.</p>}</div>}
  </div>;
}
