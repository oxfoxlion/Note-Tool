'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import { Card } from '../lib/noteToolApi';

type UseCardMentionsParams = {
  content: string;
  setContent: (value: string) => void;
  editorRef: RefObject<HTMLTextAreaElement | null>;
};

export function useCardMentions({ content, setContent, editorRef }: UseCardMentionsParams) {
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMentions) return;
    const menu = mentionMenuRef.current;
    if (!menu) return;
    const adjust = () => {
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const padding = 8;
      let left = mentionPos.left;
      let top = mentionPos.top;
      if (left < padding) {
        left = padding;
      }
      if (top < padding) {
        top = padding;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      if (left + menuWidth > viewportWidth - padding) {
        left = Math.max(padding, viewportWidth - menuWidth - padding);
      }
      if (top + menuHeight > viewportHeight - padding) {
        const above = mentionPos.top - (menuHeight + 8);
        if (above >= padding) {
          top = above;
        } else {
          top = Math.max(padding, viewportHeight - menuHeight - padding);
        }
      }
      if (left !== mentionPos.left || top !== mentionPos.top) {
        setMentionPos({ left, top });
      }
    };
    const raf = requestAnimationFrame(adjust);
    return () => cancelAnimationFrame(raf);
  }, [showMentions, mentionPos]);

  const getCaretCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.left = '0px';
    div.style.top = '0px';
    div.style.font = style.font;
    div.style.letterSpacing = style.letterSpacing;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.boxSizing = style.boxSizing;
    div.style.width = style.width;
    div.style.lineHeight = style.lineHeight;
    div.style.overflow = 'hidden';
    div.textContent = textarea.value.substring(0, position);
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(position) || '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const rect = span.getBoundingClientRect();
    const textRect = textarea.getBoundingClientRect();
    const top = rect.top - textRect.top + textarea.scrollTop;
    const left = rect.left - textRect.left + textarea.scrollLeft;
    const height = rect.height;
    document.body.removeChild(div);
    return { top, left, height };
  };

  const handleEditorChange = (next: string, textarea?: HTMLTextAreaElement | null) => {
    setContent(next);
    if (textarea) {
      editorRef.current = textarea;
    }
    const el = editorRef.current;
    if (!el) {
      setShowMentions(false);
      setMentionQuery('');
      setMentionStart(null);
      return;
    }
    const cursor = el.selectionStart ?? next.length;
    const before = next.slice(0, cursor);
    const match = before.match(/(^|\s)@([^\s@]*)$/);
    if (match) {
      const start = cursor - match[2].length - 1;
      setMentionStart(start);
      setMentionQuery(match[2]);
      setShowMentions(true);
      const coords = getCaretCoordinates(el, cursor);
      const textRect = el.getBoundingClientRect();
      setMentionPos({
        top: textRect.top + coords.top + coords.height + 14,
        left: textRect.left + coords.left,
      });
    } else {
      setShowMentions(false);
      setMentionQuery('');
      setMentionStart(null);
    }
  };

  const handleMentionSelect = (item: Card) => {
    if (mentionStart === null) return;
    const before = content.slice(0, mentionStart);
    const after = content.slice(editorRef.current?.selectionStart ?? content.length);
    const token = `@[[${item.id}|${item.title}]]`;
    const next = `${before}${token} ${after}`;
    setContent(next);
    setShowMentions(false);
    setMentionQuery('');
    setMentionStart(null);
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const pos = before.length + token.length + 1;
      el.focus();
      el.selectionStart = pos;
      el.selectionEnd = pos;
    });
  };

  return {
    mentionQuery,
    showMentions,
    mentionPos,
    mentionMenuRef,
    handleEditorChange,
    handleMentionSelect,
    handleEditorFocus: (textarea: HTMLTextAreaElement) => {
      editorRef.current = textarea;
    },
    handleEditorBlur: () => {
      setTimeout(() => setShowMentions(false), 100);
    },
  };
}
