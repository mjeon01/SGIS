import type {ResponsePlan} from '@/types';

export default function ResponsePlans({plans}:{plans:ResponsePlan[]}) {
  return <div className="response-plans">{plans.map((plan,index)=><details className="response-plan" key={plan.id} open={index===0}>
    <summary><span className="plan-number">{String(index+1).padStart(2,'0')}</span><span><small>{plan.factor_names.join(' · ')}</small><b>{plan.title}</b></span></summary>
    <div className="plan-body">
      <p className="plan-reason">{plan.reason}</p>
      <h4>실행 제안</h4><ol>{plan.steps.map(step=><li key={step}>{step}</li>)}</ol>
      <div className="plan-collaboration"><b>함께 확인할 곳</b><p>{plan.partners}</p></div>
      <div className="plan-completion"><b>점검 후 남길 결과</b><p>{plan.completion}</p></div>
      <div className="plan-basis"><b>공식 자료의 대응 원칙</b><p>{plan.basis}</p>{plan.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.publisher} · {source.title} ↗</a>)}</div>
      <p className="plan-condition">{plan.condition}</p>
    </div>
  </details>)}{!plans.length&&<p className="section-caption">관련 지표를 확보한 뒤 대응 방향을 검토할 수 있습니다.</p>}</div>;
}
