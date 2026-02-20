'use client';

import { useState } from 'react';
import { CardShareLink, createCardShareLink, getCardShareLinks, revokeCardShareLink } from '../lib/noteToolApi';

type UseCardShareOptions = {
  onUnauthorized?: () => void;
};

export function useCardShare(cardId: number | null, options: UseCardShareOptions = {}) {
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState<CardShareLink[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');

  const isUnauthorized = (err: unknown) => (err as { message?: string })?.message === 'UNAUTHORIZED';

  const toShareUrl = (token: string) => {
    if (typeof window === 'undefined') return `/shared-card/${token}`;
    return `${window.location.origin}/shared-card/${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
      } catch {
        return false;
      }
    }
  };

  const openShare = async (targetCardId?: number) => {
    const effectiveCardId = targetCardId ?? cardId;
    if (!effectiveCardId) return;
    setShareError('');
    setShareBusy(true);
    try {
      const links = await getCardShareLinks(effectiveCardId);
      setShareLinks(links);
      setShowShare(true);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        options.onUnauthorized?.();
        return;
      }
      setShareError('Failed to load share links.');
      setShowShare(true);
    } finally {
      setShareBusy(false);
    }
  };

  const createShareLink = async () => {
    if (!cardId) return;
    setShareError('');
    setShareBusy(true);
    try {
      const created = await createCardShareLink(cardId, { permission: 'read' });
      setShareLinks((prev) => [created, ...prev]);
      const copied = await copyToClipboard(toShareUrl(created.token));
      if (!copied) {
        setShareError('Link created, but auto-copy is unavailable in this browser.');
      }
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        options.onUnauthorized?.();
        return;
      }
      setShareError('Failed to create share link.');
    } finally {
      setShareBusy(false);
    }
  };

  const revokeShareLink = async (shareLinkId: number) => {
    if (!cardId) return;
    setShareError('');
    setShareBusy(true);
    try {
      await revokeCardShareLink(cardId, shareLinkId);
      setShareLinks((prev) => prev.filter((link) => link.id !== shareLinkId));
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        options.onUnauthorized?.();
        return;
      }
      setShareError('Failed to revoke share link.');
    } finally {
      setShareBusy(false);
    }
  };

  const closeShare = () => {
    setShowShare(false);
    setShareError('');
  };

  return {
    showShare,
    shareLinks,
    shareBusy,
    shareError,
    setShareError,
    toShareUrl,
    copyToClipboard,
    openShare,
    createShareLink,
    revokeShareLink,
    closeShare,
  };
}
