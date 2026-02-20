'use client';

import { RefObject, useEffect } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  onOutside: () => void
) {
  useEffect(() => {
    if (!enabled) return;
    const handleClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [enabled, onOutside, ref]);
}
