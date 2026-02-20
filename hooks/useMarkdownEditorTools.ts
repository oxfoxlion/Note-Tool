'use client';

import { RefObject } from 'react';

type UseMarkdownEditorToolsParams = {
  content: string;
  setContent: (value: string) => void;
  editorRef: RefObject<HTMLTextAreaElement | null>;
};

export function useMarkdownEditorTools({
  content,
  setContent,
  editorRef,
}: UseMarkdownEditorToolsParams) {
  const wrapSelection = (before: string, after: string = before) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = end + before.length;
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lines = content.slice(start, end).split('\n');
    const nextLines = lines.map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`));
    const next = content.slice(0, start) + nextLines.join('\n') + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = start + nextLines.join('\n').length;
    });
  };

  const insertOrderedList = () => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lines = content.slice(start, end).split('\n');
    const nextLines = lines.map((line, idx) => {
      const match = line.match(/^(\s*)(?:\d+\.\s+)?(.*)$/);
      const indent = match?.[1] ?? '';
      const text = match?.[2] ?? line.trimStart();
      return `${indent}${idx + 1}. ${text}`;
    });
    const next = content.slice(0, start) + nextLines.join('\n') + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = start + nextLines.join('\n').length;
    });
  };

  const incrementHeading = () => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const lines = selected.split('\n');
    const nextLines = lines.map((line) => {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const nextHashes = match[1].length >= 6 ? match[1] : `${match[1]}#`;
        return `${nextHashes} ${match[2]}`;
      }
      if (!line.trim()) {
        return '# ';
      }
      return `# ${line}`;
    });
    const next = content.slice(0, start) + nextLines.join('\n') + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = start + nextLines.join('\n').length;
    });
  };

  const insertBlock = (block: string) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + block + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + block.length;
      el.selectionEnd = start + block.length;
    });
  };

  const toggleTaskAtIndex = (targetTaskIndex: number) => {
    if (targetTaskIndex < 0) return;
    const taskPattern = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s*)/gm;
    let index = 0;
    let match: RegExpExecArray | null;
    while ((match = taskPattern.exec(content))) {
      if (index === targetTaskIndex) {
        const next = match[2].toLowerCase() === 'x' ? ' ' : 'x';
        const start = match.index;
        const end = start + match[0].length;
        const replaced = `${match[1]}${next}${match[3]}`;
        setContent(content.slice(0, start) + replaced + content.slice(end));
        return;
      }
      index += 1;
    }
  };

  return {
    wrapSelection,
    insertLinePrefix,
    insertOrderedList,
    incrementHeading,
    insertBlock,
    toggleTaskAtIndex,
  };
}
