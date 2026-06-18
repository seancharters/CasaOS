import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/layout/ThemeProvider';

export const metadata: Metadata = {
  title: 'Cloud Context HUD',
  description: 'Live monitoring dashboard',
};

// Inline script runs synchronously before paint to prevent flash of wrong theme
const themeScript = `(function(){try{var t=localStorage.getItem('hud-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-hud-bg">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
