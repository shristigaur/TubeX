import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'TubeX — The Premier Marketplace for Buying and Selling YouTube Channels',
  description:
    'Discover, evaluate, and acquire monetized YouTube channels across technology, finance, gaming, and education with verified performance metrics and structured escrow readiness.',
  keywords: [
    'YouTube channel marketplace',
    'buy YouTube channels',
    'sell YouTube channel',
    'monetized channels',
    'digital asset escrow',
    'TubeX',
  ],
  authors: [{ name: 'TubeX Marketplace Team' }],
  openGraph: {
    title: 'TubeX — The Premier Marketplace for Buying and Selling YouTube Channels',
    description:
      'Discover, evaluate, and acquire monetized YouTube channels with verified analytics and escrow transfer protocols.',
    url: 'https://tubex.market',
    siteName: 'TubeX',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

