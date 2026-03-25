'use client';

import { useEffect } from 'react';
import { applyThemeMode, getInitialThemeMode } from '../../lib/theme';

export default function ThemeSync() {
  useEffect(() => {
    applyThemeMode(getInitialThemeMode());
  }, []);

  return null;
}
