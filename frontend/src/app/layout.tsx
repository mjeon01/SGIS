import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

export const metadata: Metadata = { title: '기후안심지도 · ClimateGuard', description: 'SGIS 공간통계로 살펴보는 우리 지역의 폭염 취약성' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ko"><body>{children}</body></html>;
}
