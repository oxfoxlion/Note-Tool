'use client';

import { useCallback, useEffect, useState } from 'react';

const CURRENT_SPACE_STORAGE_KEY = 'note_tool_current_space_id';
const CURRENT_SPACE_EVENT = 'note_tool_current_space_changed';

function readCurrentSpaceIdFromStorage(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_SPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredCurrentSpaceId() {
  return readCurrentSpaceIdFromStorage();
}

export function setStoredCurrentSpaceId(spaceId: number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (spaceId === null) {
      window.localStorage.removeItem(CURRENT_SPACE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CURRENT_SPACE_STORAGE_KEY, String(spaceId));
    }
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(CURRENT_SPACE_EVENT, { detail: { spaceId } }));
}

export function useCurrentSpace() {
  const [currentSpaceId, setCurrentSpaceIdState] = useState<number | null>(() => readCurrentSpaceIdFromStorage());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CURRENT_SPACE_STORAGE_KEY) return;
      setCurrentSpaceIdState(readCurrentSpaceIdFromStorage());
    };
    const handleCustomEvent = () => {
      setCurrentSpaceIdState(readCurrentSpaceIdFromStorage());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CURRENT_SPACE_EVENT, handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CURRENT_SPACE_EVENT, handleCustomEvent);
    };
  }, []);

  const setCurrentSpaceId = useCallback((spaceId: number | null) => {
    setStoredCurrentSpaceId(spaceId);
    setCurrentSpaceIdState(spaceId);
  }, []);

  return { currentSpaceId, setCurrentSpaceId };
}
