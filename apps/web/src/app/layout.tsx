import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Menu } from '@/components/Menu';
import { BarraStatus } from '@/components/status/BarraStatus';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frank',
  description: 'Agente que vigia passagens aéreas e avisa quando aparece um preço muito baixo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <Menu />
        <BarraStatus />
        {children}
      </body>
    </html>
  );
}
