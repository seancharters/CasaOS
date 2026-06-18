'use client';

import { useState, useEffect } from 'react';
import { ThemeContext } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('hud-theme') as Theme | null;
    const initial: Theme = stored === 'light' ? 'light' : 'dark';
    setTheme(initial);
    document.documentElement.classList.toggle('light', initial === 'light');
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('hud-theme', next);
      document.documentElement.classList.toggle('light', next === 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
