import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './map-shell.css';
import './map-usability.css';
import './map-timeline.css';
import './map-regions.css';
import './map-readiness.css';
import './ui-theme.css';
import './map-journey.css';
import './map-weather-experience.css';
import './map-guide.css';

export const metadata: Metadata = { title: '기후안심지도 · 기후 대비할 동네 찾기', description: '지역 특성과 재해 기록으로 살펴볼 동네와 시설을 찾고, 나의 기후 대비 점검 목록을 만드세요.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ko"><body>{children}</body></html>;
}
