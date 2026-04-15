'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../lib/markdownSanitize';
import type { Card } from '../lib/noteToolApi';
import { useCardShare } from '../hooks/useCardShare';
import { useCardBoardMembership } from '../hooks/useCardBoardMembership';
import { useCardLinks } from '../hooks/useCardLinks';
import { useCurrentSpace } from '../hooks/useCurrentSpace';
import CardActionsMenu from './cards/CardActionsMenu';
import CardShareLinksModal from './cards/CardShareLinksModal';
import CardRemoveFromBoardModal from './cards/CardRemoveFromBoardModal';
import CardCopyToSpaceModal from './cards/CardCopyToSpaceModal';
import { copyCardToSpace, getSpaces, Space } from '../lib/noteToolApi';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Sheet, SheetContent } from './ui/sheet';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

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
  boardLinkedCardIds?: number[];
};

type MarkdownInputProps = InputHTMLAttributes<HTMLInputElement> & {
  node?: {
    position?: {
      start?: {
        offset?: number;
        line?: number;
      };
    };
  };
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
  boardLinkedCardIds = [],
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
  const [showCopyToSpace, setShowCopyToSpace] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [copyBusySpaceId, setCopyBusySpaceId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copySuccessMessage, setCopySuccessMessage] = useState('');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const prevCardIdRef = useRef(card.id);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const { currentSpaceId } = useCurrentSpace();

  const share = useCardShare(card.id);
  const removeMembership = useCardBoardMembership(card.id);

  useEffect(() => {
    if (prevCardIdRef.current === card.id) return;
    prevCardIdRef.current = card.id;
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
    if (!showCopyToSpace) return;
    let active = true;
    const loadSpaces = async () => {
      try {
        const data = await getSpaces();
        if (!active) return;
        setSpaces(data);
      } catch {
        if (!active) return;
        setCopyError('Failed to load spaces.');
      }
    };
    void loadSpaces();
    return () => {
      active = false;
    };
  }, [showCopyToSpace]);

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

  const linkedCards = useCardLinks({
    allCards,
    content,
    cardId: card.id,
    additionalLinkedIds: boardLinkedCardIds,
  });

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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          input: ({ node, ...props }: MarkdownInputProps) => {
            if (props.type === 'checkbox') {
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
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card px-2 py-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={incrementHeading}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Heading (add #)"
        aria-label="Heading"
      >
        <span className="text-xs font-semibold">H</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('**')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Bold"
        aria-label="Bold"
      >
        <span className="text-xs font-semibold">B</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('*')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Italic"
        aria-label="Italic"
      >
        <span className="text-xs italic">I</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('<u>', '</u>')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Underline"
        aria-label="Underline"
      >
        <span className="text-xs underline">U</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('~~')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <span className="text-xs line-through">S</span>
      </button>
      <button
        type="button"
        onClick={() => wrapSelection('`')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        title="Inline code"
        aria-label="Inline code"
      >
        <span className="text-[10px] font-mono">{'</>'}</span>
      </button>
      <button
        type="button"
        onClick={() => insertLinePrefix('- ')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
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
      <div className="card-editor-surface [&_.w-md-editor]:min-h-[280px] [&_.w-md-editor]:overflow-hidden [&_.w-md-editor]:rounded-xl [&_.w-md-editor]:border-border [&_.w-md-editor]:bg-muted [&_.w-md-editor]:text-card-foreground [&_.w-md-editor-text]:text-sm [&_.w-md-editor-text-input]:text-sm [&_.w-md-editor-text-input]:text-card-foreground [&_.w-md-editor-text-pre]:text-sm [&_.w-md-editor-text-pre]:text-card-foreground [&_.w-md-editor-text-container]:bg-muted [&_.wmde-markdown]:bg-muted [&_.wmde-markdown]:text-card-foreground">
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
        router.push(`/cards/${cardId}`);
        return;
      }
    }
    if (href) {
      event.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenShareMenu = useCallback(() => {
    setShowCardMenu(false);
    void share.openShare();
  }, [share]);

  const handleOpenRemoveMenu = useCallback(() => {
    setShowCardMenu(false);
    void removeMembership.openRemovePicker();
  }, [removeMembership]);

  const handleOpenCopyMenu = useCallback(() => {
    setShowCardMenu(false);
    setCopyError('');
    setCopySuccessMessage('');
    setShowCopyToSpace(true);
  }, []);

  const handleCopyToSpace = useCallback(async (targetSpaceId: number) => {
    setCopyError('');
    setCopySuccessMessage('');
    setCopyBusySpaceId(targetSpaceId);
    try {
      const copied = await copyCardToSpace(card.id, targetSpaceId);
      setCopySuccessMessage(`Copied as card #${copied.id}.`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        ((err as { message?: string })?.message === 'UNAUTHORIZED'
          ? 'Login expired. Please sign in again.'
          : 'Failed to copy card.');
      setCopyError(message);
    } finally {
      setCopyBusySpaceId(null);
    }
  }, [card.id]);

  const actionItems = [
    { id: 'share', label: 'Share card', onClick: handleOpenShareMenu },
    { id: 'copy-to-space', label: 'Copy to space', onClick: handleOpenCopyMenu },
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

  const panelBody = (
    <>
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <nav className="flex flex-1 items-center gap-2 text-xs font-medium text-muted-foreground">
            <Button type="button" variant="ghost" onClick={onClose} className="h-auto px-0 py-0 text-xs text-muted-foreground hover:bg-transparent hover:text-card-foreground">
              {breadcrumbRootLabel}
            </Button>
            <span>/</span>
            {readOnly ? (
              <div className="w-28 truncate p-0 text-xs font-semibold text-card-foreground sm:w-40">{title || 'Untitled'}</div>
            ) : (
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-auto w-28 border-0 bg-transparent p-0 text-xs font-semibold text-card-foreground shadow-none ring-0 focus-visible:ring-0 sm:w-40"
                placeholder="Untitled"
              />
            )}
          </nav>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'view' | 'edit')}>
                  <TabsList className="rounded-full">
                    <TabsTrigger value="edit" className="rounded-full px-3" aria-label="Edit" title="Edit">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M13.5 5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </TabsTrigger>
                    <TabsTrigger value="view" className="rounded-full px-3" aria-label="Preview" title="Preview">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path d="M2.5 12c2.2-4.2 6.6-7 9.5-7s7.3 2.8 9.5 7c-2.2 4.2-6.6 7-9.5 7s-7.3-2.8-9.5-7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => router.push(`/cards/${card.id}`)}
                  className="rounded-full"
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M7 3H3v4M21 7V3h-4M3 17v4h4M17 21h4v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </Button>
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              className="rounded-full"
              aria-label="Close"
              title="Close"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {!readOnly && viewMode === 'edit' ? (
            <div className="space-y-4">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border-0 bg-transparent px-0 py-1 text-sm font-semibold text-card-foreground shadow-none ring-0 focus-visible:ring-0"
                placeholder="Card title"
              />
              {renderToolbar()}
              <div className="relative flex-1 min-h-0 overflow-visible">
                {renderEditor()}
                {showMentions && (
                  <div className="absolute z-50 mt-2 w-full max-w-sm rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg">
                    <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Link card
                    </div>
                    <div className="max-h-52 overflow-y-auto p-2">
                      {allCards
                        .filter((item) => item.id !== card.id)
                        .filter((item) => (mentionQuery ? item.title.toLowerCase().includes(mentionQuery.toLowerCase()) : true))
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
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition hover:bg-accent hover:text-accent-foreground"
                          >
                            <span className="truncate">{item.title}</span>
                            <span className="text-xs text-muted-foreground">#{item.id}</span>
                          </button>
                        ))}
                      {allCards.filter((item) => item.id !== card.id).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No cards available.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end text-xs text-muted-foreground">{isSaving ? 'Saving…' : 'Autosave on'}</div>
            </div>
          ) : (
            <div className="space-y-6" onClickCapture={handleViewClickCapture}>
              <article className="card-preview-surface prose max-w-none text-sm leading-relaxed text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-strong:text-card-foreground prose-code:text-card-foreground prose-pre:bg-muted prose-pre:text-card-foreground prose-li:text-card-foreground prose-blockquote:text-muted-foreground prose-a:text-card-foreground">
                {renderMarkdown(content || 'No content yet.')}
              </article>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Linked cards</div>
                <div className="mt-3 space-y-2">
                  {linkedCards.length === 0 && <div className="text-sm text-muted-foreground">No linked cards.</div>}
                  {linkedCards.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (onNavigateCard) {
                          onNavigateCard(item.id);
                          return;
                        }
                        router.push(`/cards/${item.id}`);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="truncate">@{item.title}</span>
                      <span className="text-xs text-muted-foreground">#{item.id}</span>
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
        sharePassword={share.sharePassword}
        onSharePasswordChange={share.setSharePassword}
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

      <CardCopyToSpaceModal
        open={showCopyToSpace}
        cardTitle={card.title}
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        busySpaceId={copyBusySpaceId}
        error={copyError}
        successMessage={copySuccessMessage}
        onClose={() => {
          setShowCopyToSpace(false);
          setCopyError('');
          setCopySuccessMessage('');
        }}
        onCopy={handleCopyToSpace}
      />

      {showDeleteConfirm && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this card?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete the card.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete?.();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );

  const overlay = mode === 'modal' ? (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-0">
        <DialogTitle className="sr-only">Card details</DialogTitle>
        <DialogDescription className="sr-only">
          View and edit card content in modal.
        </DialogDescription>
        {panelBody}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="h-full w-full max-w-xl overflow-hidden border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-0">
        {panelBody}
      </SheetContent>
    </Sheet>
  );

  return overlay;
}
