'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/services/api';

/** Cache whole snapshots. Moving a time slider never starts an API request. */
export function useSnapshot<T>(path:string,enabled=true) {
  const cache=useRef(new Map<string,T>());
  const [result,setResult]=useState<{path:string;data:T|null;error:string|null}>({path:'',data:null,error:null});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!enabled)return;
    const cached=cache.current.get(path);
    if(cached){setResult({path,data:cached,error:null});return;}
    const abort=new AbortController();
    setResult({path,data:null,error:null});
    api<T>(path,abort.signal).then(data=>{cache.current.set(path,data);setResult({path,data,error:null});})
      .catch(e=>{if(e.name!=='AbortError')setResult({path,data:null,error:e.message});});
    return()=>abort.abort();
  },[path,enabled,attempt]);
  const data=cache.current.get(path)||(result.path===path?result.data:null);
  const error=result.path===path?result.error:null;
  return {data,error,loading:enabled&&!data&&!error,retry:()=>{cache.current.delete(path);setAttempt(n=>n+1);}};
}
