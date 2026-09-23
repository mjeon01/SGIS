import {Sun,Waves} from 'lucide-react';
export default function DisasterSwitch({value,onChange}:{value:'heat'|'flood';onChange:(value:'heat'|'flood')=>void}) {
 return <div className="disaster-switch" role="group" aria-label="재난 유형"><button aria-pressed={value==='heat'} onClick={()=>onChange('heat')}><Sun size={18}/>폭염</button><button aria-pressed={value==='flood'} onClick={()=>onChange('flood')}><Waves size={18}/>침수</button></div>;
}
