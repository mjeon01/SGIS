export default function WeatherLegend(){
 return <div className="weather-map-notice"><div className="weather-color-key" aria-label="관측 기온 색상 범례">{[['#477f93','27℃ 미만'],['#ad8432','27~30℃ 미만'],['#c76b30','30~33℃ 미만'],['#b74132','33℃ 이상'],['#86918b','관측 없음']].map(([color,label])=><span key={label}><i style={{background:color}}/>{label}</span>)}</div><p>관측소 위치의 일 최고기온입니다.</p></div>;
}
