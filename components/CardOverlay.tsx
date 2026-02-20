'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MDEditor from '@uiw/react-md-editor';
import { createPortal } from 'react-dom';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../lib/markdownSanitize';
import type { Card } from '../lib/noteToolApi';
import { useCardShare } from '../hooks/useCardShare';
import { useCardBoardMembership } from '../hooks/useCardBoardMembership';
import CardActionsMenu from './cards/CardActionsMenu';
import CardShareLinksModal from './cards/CardShareLinksModal';
import CardRemoveFromBoardModal from './cards/CardRemoveFromBoardModal';

type CardOverlayProps = {
  card: Card;
  mode: 'modal' | 'sidepanel';
  onClose: () => void;
  onSave: (next: { title: string; content: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onRemoveFromBoard?: (boardId: number, cardId: number) => Promise<void> | void;
  allCards?: Card[];
  readOnly?: boolean;
  onNavigateCard?: (cardId: number) => void;
  breadcrumbRootLabel?: string;
};

export default function CardOverlay({
  card,
  mode,
  onClose,
  onSave,
  onDelete,
  onRemoveFromBoard,
  allCards = [],
  readOnly = false,
  onNavigateCard,
  breadcrumbRootLabel = 'Card Box',
}: CardOverlayProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string }>({
    title: card.title,
    content: card.content ?? '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);

  const share = useCardShare(card.id);
  const removeMembership = useCardBoardMembership(card.id);

  useEffect(() => {
    setTitle(card.title);
    setContent(card.content ?? '');
    setViewMode('view');
    lastSavedRef.current = { title: card.title, content: card.content ?? '' };
    setShowMentions(false);
    setMentionQuery('');
    setMentionStart(null);
    setShowCardMenu(false);
  }, [card.id, card.title, card.content]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode !== 'sidepanel') return;
    const root = document.getElementById('app-root') ?? document.documentElement;
    const media = window.matchMedia('(max-width: 1024px)');
    const applyWidth = () => {
      (root as HTMLElement).style.setProperty('--sidepanel-width', media.matches ? '0px' : '36rem');
    };
    root.classList.add('has-sidepanel');
    applyWidth();
    media.addEventListener('change', applyWidth);
    return () => {
      media.removeEventListener('change', applyWidth);
      root.classList.remove('has-sidepanel');
      (root as HTMLElement).style.removeProperty('--sidepanel-width');
    };
  }, [mode]);

  useEffect(() => {
    if (readOnly) return;
    if (viewMode === 'view') return;
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      Promise.resolve(onSave({ title, content }))
        .then(() => {
          lastSavedRef.current = { title, content };
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, 800);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, content, viewMode, onSave, readOnly]);

  const cardMap = useMemo(() => {
    const map = new Map<number, Card>();
    allCards.forEach((item) => map.set(item.id, item));
    return map;
  }, [allCards]);

  const mentionedIds = useMemo(() => {
    const ids = new Set<number>();
    const regex = /@\[\[(\d+)\|[^\]]+\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      ids.add(Number(match[1]));
    }
    return Array.from(ids);
  }, [content]);

  const incomingIds = useMemo(() => {
    const ids = new Set<number>();
    const regex = new RegExp(`@\\[\\[${card.id}\\|[^\\]]+\\]\\]`, 'g');
    allCards.forEach((item) => {
      if (item.id === card.id || !item.content) return;
      if (regex.test(item.content)) {
        ids.add(item.id);
      }
    });
    return Array.from(ids);
  }, [allCards, card.id]);

  const linkedCards = Array.from(new Set([...mentionedIds, ...incomingIds]))
    .map((id) => cardMap.get(id))
    .filter((item): item is Card => Boolean(item));

  const prepareMarkdown = (text: string) =>
    text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '[@$2](/cards/$1)');

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

  const findTaskIndexByOffset = (source: string, offset: number) => {
    const taskPattern = /^(\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*)/gm;
    let index = 0;
    let match: RegExpExecArray | null;
    while ((match = taskPattern.exec(source))) {
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) return index;
      if (offset < start) return index;
      index += 1;
    }
    return -1;
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

  const renderMarkdown = (text: string) => {
    const preparedSource = prepareMarkdown(text);
    const taskLineNumbers = text
      .split('\n')
      .map((line, idx) => (line.match(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+/) ? idx + 1 : null))
      .filter((line): line is number => line !== null);
    let renderTaskIndex = 0;

    return (
      <MDEditor.Markdown
        source={preparedSource}
        wrapperElement={{ 'data-color-mode': 'light' }}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          input: ({ ...props }: Record<string, unknown>) => {
            if (props.type === 'checkbox') {
              const node = props.node as
                | {
                    position?: {
                      start?: {
                        offset?: number;
                        line?: number;
                      };
                    };
                  }
                | undefined;
              const offset = Number(node?.position?.start?.offset);
              const lineFromNode = Number(node?.position?.start?.line);
              const fallbackTaskIndex = renderTaskIndex;
              renderTaskIndex += 1;
              const isReadOnly = readOnly || viewMode === 'view';
              return (
                <input
                  type="checkbox"
                  checked={Boolean(props.checked)}
                  disabled={isReadOnly}
                  readOnly={isReadOnly}
                  onChange={(event) => {
                    if (isReadOnly) return;
                    event.preventDefault();
                    let taskIndex = -1;
                    if (Number.isFinite(offset)) {
                      taskIndex = findTaskIndexByOffset(preparedSource, offset);
                    } else if (Number.isFinite(lineFromNode)) {
                      taskIndex = taskLineNumbers.findIndex((line) => line === lineFromNode);
                    } else {
                      taskIndex = fallbackTaskIndex;
                    }
                    toggleTaskAtIndex(taskIndex);
                  }}
                />
              );
            }
            return <input {...props} />;
          },
        }}
      />
    );
  };

  const renderToolbar = () => (
    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600">
      <button
        type="button"
        onClick={incrementHeading}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Heading (add #)"
        aria-label="Heading"
      >
        <span className="text-xs font-semibold">H</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('**')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Bold"
        aria-label="Bold"
      >
        <span className="text-xs font-semibold">B</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('*')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Italic"
        aria-label="Italic"
      >
        <span className="text-xs italic">I</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('<u>', '</u>')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Underline"
        aria-label="Underline"
      >
        <span className="text-xs underline">U</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('~~')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <span className="text-xs line-through">S</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('`')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Inline code"
        aria-label="Inline code"
      >
        <span className="text-[10px] font-mono">{'</>'}</span>
      </button>
      <button
        type="button"
        onClick={() => insertLinePrefix('- ')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Bulleted list"
        aria-label="Bulleted list"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M6 7h13M6 12h13M6 17h13" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="4" cy="7" r="1.2" fill="currentColor" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" />
          <circle cx="4" cy="17" r="1.2" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        onClick={insertOrderedList}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Numbered list"
        aria-label="Numbered list"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M8 7h11M8 12h11M8 17h11" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M3 7h2M3 12h2M3 17h2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertLinePrefix('> ')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Quote"
        aria-label="Quote"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M7 8h3v3H7zM14 8h3v3h-3z" fill="currentColor" />
          <path d="M7 13h6M14 13h3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertLinePrefix('- [ ] ')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Checkbox"
        aria-label="Checkbox"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M13 9h7M13 15h7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 8.8l1.6 1.6 2.4-3" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertBlock('\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Table"
        aria-label="Table"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M4 10h16M10 6v12" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('[', '](url)')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Link"
        aria-label="Link"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M10 13a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M14 11a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertBlock('\n![image](https://example.png)\n')}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Image"
        aria-label="Image"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="9" cy="11" r="1.6" fill="currentColor" />
          <path d="M4 16l4-4 3 3 4-4 5 5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
    </div>
  );

  const renderEditor = () => {
    const handleEditorChange = (nextValue?: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = nextValue ?? '';
      setContent(next);
      if (event?.currentTarget) {
        editorRef.current = event.currentTarget;
      }
      const el = editorRef.current;
      const cursor = el?.selectionStart ?? next.length;
      const before = next.slice(0, cursor);
      const match = before.match(/(^|\s)@([^\s@]*)$/);
      if (match) {
        const start = cursor - match[2].length - 1;
        setMentionStart(start);
        setMentionQuery(match[2]);
        setShowMentions(true);
      } else {
        setShowMentions(false);
        setMentionQuery('');
        setMentionStart(null);
      }
    };

    return (
      <div
        data-color-mode="light"
        className="[&_.w-md-editor]:min-h-[280px] [&_.w-md-editor]:overflow-hidden [&_.w-md-editor]:rounded-xl [&_.w-md-editor]:border-slate-200 [&_.w-md-editor]:bg-slate-50 [&_.w-md-editor-text]:text-sm [&_.w-md-editor-text-input]:text-sm [&_.w-md-editor-text-pre]:text-sm"
      >
        <MDEditor
          value={content}
          onChange={handleEditorChange}
          preview="edit"
          hideToolbar
          visibleDragbar={false}
          height={320}
          textareaProps={{
            placeholder: 'Write your markdown...',
            onFocus: (event) => {
              editorRef.current = event.currentTarget;
            },
            onBlur: () => {
              setTimeout(() => setShowMentions(false), 100);
            },
          }}
        />
      </div>
    );
  };

  const wrapperClass =
    mode === 'modal'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
      : 'fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl';

  const panelClass =
    mode === 'modal'
      ? 'w-full max-w-2xl rounded-2xl bg-white shadow-2xl'
      : 'h-full w-full overflow-y-auto';

  const handleViewClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    const match = href?.match(/^\/cards\/(\d+)(?:[/?#].*)?$/);
    if (match) {
      const cardId = Number(match[1]);
      if (Number.isFinite(cardId)) {
        event.preventDefault();
        if (onNavigateCard) {
          onNavigateCard(cardId);
          return;
        }
      }
    }
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  };

  const handleOpenShareMenu = useCallback(() => {
    setShowCardMenu(false);
    void share.openShare();
  }, [share]);

  const handleOpenRemoveMenu = useCallback(() => {
    setShowCardMenu(false);
    void removeMembership.openRemovePicker();
  }, [removeMembership]);

  const actionItems = [
    { id: 'share', label: 'Share card', onClick: handleOpenShareMenu },
    ...(onRemoveFromBoard
      ? [{ id: 'remove', label: 'Remove from board', onClick: handleOpenRemoveMenu }]
      : []),
    ...(onDelete
      ? [
          {
            id: 'delete',
            label: 'Delete card',
            tone: 'danger' as const,
            onClick: () => {
              setShowCardMenu(false);
              setShowDeleteConfirm(true);
            },
          },
        ]
      : []),
  ];

  const overlay = (
    <div className={wrapperClass} role="dialog" aria-modal="true">
      {mode === 'modal' && (
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={onClose}
        />
      )}
      <div className={`relative ${panelClass} flex h-full flex-col`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <nav className="flex flex-1 items-center gap-2 text-xs font-medium text-slate-500">
            <button type="button" onClick={onClose} className="hover:text-slate-700">
              {breadcrumbRootLabel}
            </button>
            <span>/</span>
            {readOnly ? (
              <div className="w-28 truncate p-0 text-xs font-semibold text-slate-700 sm:w-40">{title || 'Untitled'}</div>
            ) : (
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-28 border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 focus:outline-none sm:w-40"
                placeholder="Untitled"
              />
            )}
          </nav>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`rounded-full p-2 ${
                      viewMode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    aria-label="Edit"
                    title="Edit"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path d="M13.5 5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('view')}
                    className={`rounded-full p-2 ${
                      viewMode === 'view' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    aria-label="Preview"
                    title="Preview"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M2.5 12c2.2-4.2 6.6-7 9.5-7s7.3 2.8 9.5 7c-2.2 4.2-6.6 7-9.5 7s-7.3-2.8-9.5-7z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/cards/${card.id}`)}
                  className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M7 3H3v4M21 7V3h-4M3 17v4h4M17 21h4v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              </>
            )}
            {(onDelete || onRemoveFromBoard) && (
              <CardActionsMenu
                open={showCardMenu}
                onToggle={() => setShowCardMenu((prev) => !prev)}
                onClose={() => setShowCardMenu(false)}
                actions={actionItems}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Close"
              title="Close"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {!readOnly && viewMode === 'edit' ? (
            <div className="space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border-0 bg-transparent px-0 py-1 text-sm font-semibold text-slate-900 focus:outline-none"
                placeholder="Card title"
              />
              {renderToolbar()}
              <div className="relative flex-1 min-h-0 overflow-visible">
                {renderEditor()}
                {showMentions && (
                  <div className="absolute z-50 mt-2 w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-200 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Link card
                    </div>
                    <div className="max-h-52 overflow-y-auto p-2">
                      {allCards
                        .filter((item) => item.id !== card.id)
                        .filter((item) =>
                          mentionQuery
                            ? item.title.toLowerCase().includes(mentionQuery.toLowerCase())
                            : true
                        )
                        .slice(0, 8)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
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
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="truncate">{item.title}</span>
                            <span className="text-xs text-slate-400">#{item.id}</span>
                          </button>
                        ))}
                      {allCards.filter((item) => item.id !== card.id).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No cards available.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end text-xs text-slate-500">
                {isSaving ? 'Saving…' : 'Autosave on'}
              </div>
            </div>
          ) : (
            <div className="space-y-6" onClickCapture={handleViewClickCapture}>
              <article className="prose max-w-none text-sm leading-relaxed text-slate-700">
                {renderMarkdown(content || 'No content yet.')}
              </article>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Linked cards
                </div>
                <div className="mt-3 space-y-2">
                  {linkedCards.length === 0 && (
                    <div className="text-sm text-slate-500">No linked cards.</div>
                  )}
                  {linkedCards.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (onNavigateCard) {
                          onNavigateCard(item.id);
                          return;
                        }
                        onClose();
                        router.push(`/cards/${item.id}`);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate">@{item.title}</span>
                      <span className="text-xs text-slate-400">#{item.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CardShareLinksModal
        open={share.showShare}
        links={share.shareLinks}
        busy={share.shareBusy}
        error={share.shareError}
        toShareUrl={share.toShareUrl}
        onClose={share.closeShare}
        onCreate={share.createShareLink}
        onCopy={async (url) => {
          const copied = await share.copyToClipboard(url);
          if (!copied) {
            share.setShareError('Copy failed in this browser. Please copy the URL manually.');
          }
        }}
        onRevoke={share.revokeShareLink}
      />

      <CardRemoveFromBoardModal
        open={removeMembership.showRemovePicker}
        cardTitle={card.title}
        boards={removeMembership.removeBoards}
        busyBoardId={removeMembership.removeBusyBoardId}
        error={removeMembership.removeError}
        onClose={removeMembership.closeRemovePicker}
        onRemove={async (boardId) => {
          if (!onRemoveFromBoard) return;
          removeMembership.setRemoveError('');
          removeMembership.setRemoveBusyBoardId(boardId);
          try {
            await onRemoveFromBoard(boardId, card.id);
            removeMembership.setRemoveBoards((prev) => prev.filter((board) => board.id !== boardId));
          } catch (err: unknown) {
            const message =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              'Failed to remove from board.';
            removeMembership.setRemoveError(message);
            return;
          } finally {
            removeMembership.setRemoveBusyBoardId(null);
          }
          removeMembership.closeRemovePicker();
          onClose();
        }}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-rose-400">Confirm</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Delete this card?</h3>
            <p className="mt-2 text-sm text-slate-600">This will permanently delete the card.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete?.();
                }}
                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
