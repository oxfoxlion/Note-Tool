'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '../ui/button';
import { applyThemeMode, getInitialThemeMode, type ThemeMode } from '../../lib/theme';

type ThemeToggleProps = {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  style?: CSSProperties;
};

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 11h-2.2M5.7 11H3.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.8 8.1A4.7 4.7 0 1 0 15 16a5.3 5.3 0 0 1-.2-7.9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ThemeToggle({ className, style, variant = 'outline' }: ThemeToggleProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  const handleToggle = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={handleToggle}
      className={className}
      style={style}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <ThemeIcon />
    </Button>
  );
}
