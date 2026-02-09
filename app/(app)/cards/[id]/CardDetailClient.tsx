'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../../../../lib/markdownSanitize';
import { Card, deleteCard, getCards, removeCardFromBoard, updateCard } from '../../../../lib/noteToolApi';

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = params.id;
  const [isMobile, setIsMobile] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'split'>('view');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string }>({ title: '', content: '' });
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const boardId = useMemo(() => {
    const raw = searchParams.get('boardId');
    const parsed = raw ? Number(raw) : null;
    return Number.isFinite(parsed) ? (parsed as number) : null;
  }, [searchParams]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isMobile && viewMode === 'split') {
      setViewMode('view');
    }
  }, [isMobile, viewMode]);

  useEffect(() => {
    const load = async () => {
      try {
        const cards = await getCards();
        setAllCards(cards);
        const found = cards.find((item) => String(item.id) === String(cardId)) || null;
        setCard(found);
        if (found) {
          setTitle(found.title);
          setContent(found.content ?? '');
          lastSavedRef.current = { title: found.title, content: found.content ?? '' };
        }
      } catch (err: any) {
        if (err?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load card.');
      }
    };
    if (cardId) {
      load();
    }
  }, [cardId, router]);

  const breadcrumbs = useMemo(
    () => [
      { label: 'Card Box', href: '/cards' },
      { label: card?.title || 'Card', href: `/cards/${cardId}` },
    ],
    [card?.title, cardId]
  );

  useEffect(() => {
    if (!card) return;
    if (viewMode === 'view') return;
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      updateCard(card.id, { title, content })
        .then((updated) => {
          setCard(updated);
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
  }, [title, content, viewMode, card]);

  useEffect(() => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content, viewMode]);

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

  const toggleTaskAtLine = (line?: number) => {
    if (!line) return;
    const lines = content.split('\n');
    const idx = line - 1;
    if (idx < 0 || idx >= lines.length) return;
    const current = lines[idx];
    const match = current.match(/^(\s*[-*+]\s+\[)([ xX])(\]\s*)/);
    if (!match) return;
    const next = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    lines[idx] = current.replace(match[0], `${match[1]}${next}${match[3]}`);
    if (viewMode === 'view') {
      setViewMode('edit');
    }
    setContent(lines.join('\n'));
  };

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
    if (!card) return [];
    const regex = new RegExp(`@\\[\\[${card.id}\\|[^\\]]+\\]\\]`, 'g');
    allCards.forEach((item) => {
      if (item.id === card.id || !item.content) return;
      if (regex.test(item.content)) {
        ids.add(item.id);
      }
    });
    return Array.from(ids);
  }, [allCards, card]);

  const linkedCards = Array.from(new Set([...mentionedIds, ...incomingIds]))
    .map((id) => cardMap.get(id))
    .filter((item): item is Card => Boolean(item));

  const prepareMarkdown = (text: string) =>
    text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '[@$2](/cards/$1)');

  const renderMarkdown = (text: string) => {
    const taskLines = text
      .split('\n')
      .map((line, idx) => (line.match(/^\s*[-*+]\s+\[[ xX]\]\s+/) ? idx + 1 : null))
      .filter((line): line is number => line !== null);
    let taskIndex = 0;

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          input: ({ ...props }: any) => {
            if (props.type === 'checkbox') {
              const line = taskLines[taskIndex];
              taskIndex += 1;
              return (
                <input
                  type="checkbox"
                  checked={Boolean(props.checked)}
                  disabled={false}
                  readOnly={false}
                  onClick={() => toggleTaskAtLine(line)}
                  onChange={() => {}}
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {prepareMarkdown(text)}
      </ReactMarkdown>
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
        onClick={() => insertLinePrefix('1. ')}
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
    const lineCount = content.split('\n').length || 1;
    return (
      <div className="flex h-full gap-3 overflow-y-auto">
        <div className="select-none text-xs text-slate-400">
          {Array.from({ length: lineCount }).map((_, idx) => (
            <div key={idx} className="leading-5">
              {idx + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          value={content}
          onChange={(event) => {
            const el = event.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            const nextValue = event.target.value;
            setContent(nextValue);
            const cursor = el.selectionStart ?? nextValue.length;
            const before = nextValue.slice(0, cursor);
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
          }}
          onBlur={() => {
            setTimeout(() => setShowMentions(false), 100);
          }}
          className="w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-sm text-slate-700 focus:outline-none"
          placeholder="Write your markdown..."
        />
      </div>
    );
  };

  const handleDelete = async () => {
    if (!card) return;
    if (!confirm('Delete this card permanently?')) return;
    await deleteCard(card.id);
    router.push('/cards');
  };

  if (error) {
    return <div className="text-sm text-rose-600">{error}</div>;
  }

  if (!card) {
    return <div className="text-sm text-slate-500">Card not found.</div>;
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/cards" className="hover:text-slate-700">
            Card Box
          </Link>
          <span>/</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-40 border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 focus:outline-none"
            placeholder="Untitled"
          />
        </nav>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`rounded-full p-2 ${
                viewMode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
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
            {!isMobile && (
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`rounded-full p-2 ${
                  viewMode === 'split' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Split"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 5h7v14H4zM13 5h7v14h-7z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
          {boardId && (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Remove from board"
              title="Remove from board"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'split' ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-h-0 flex-col gap-4">
            {renderToolbar()}
          <div className="relative flex-1 min-h-0 overflow-visible" ref={editorWrapRef}>
            {renderEditor()}
            {showMentions && (
              <div
                className="fixed z-50 w-72 max-w-sm rounded-2xl border border-slate-200 bg-white shadow-lg"
                style={{ top: mentionPos.top, left: mentionPos.left }}
                ref={mentionMenuRef}
              >
                  <div className="border-b border-slate-200 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    Link card
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2">
                    {allCards
                      .filter((item) => item.id !== card.id)
                      .filter((item) =>
                        mentionQuery ? item.title.toLowerCase().includes(mentionQuery.toLowerCase()) : true
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
          <div className="h-full w-px bg-slate-200" />
          <div className="flex min-h-0 flex-col gap-6">
            <article className="prose max-w-none min-h-0 overflow-y-auto px-0 py-1 text-sm leading-relaxed text-slate-700">
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
                    onClick={() => router.push(`/cards/${item.id}`)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className="truncate">@{item.title}</span>
                    <span className="text-xs text-slate-400">#{item.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'edit' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {renderToolbar()}
          <div className="relative flex-1 min-h-0 overflow-visible" ref={editorWrapRef}>
            {renderEditor()}
            {showMentions && (
              <div
                className="fixed z-50 w-72 max-w-sm rounded-2xl border border-slate-200 bg-white shadow-lg"
                style={{ top: mentionPos.top, left: mentionPos.left }}
                ref={mentionMenuRef}
              >
                <div className="border-b border-slate-200 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Link card
                </div>
                <div className="max-h-52 overflow-y-auto p-2">
                  {allCards
                    .filter((item) => item.id !== card.id)
                    .filter((item) =>
                      mentionQuery ? item.title.toLowerCase().includes(mentionQuery.toLowerCase()) : true
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
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <article className="prose max-w-none min-h-0 overflow-y-auto text-sm leading-relaxed text-slate-700">
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
                  onClick={() => router.push(`/cards/${item.id}`)}
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

      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Remove</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Remove from board?</h3>
            <p className="mt-2 text-sm text-slate-600">This will remove the card from this board only.</p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!boardId || !card) return;
                  try {
                    await removeCardFromBoard(boardId, card.id);
                    router.push(`/boards/${boardId}`);
                  } catch (err: any) {
                    if (err?.message === 'UNAUTHORIZED') {
                      router.push('/auth/login');
                      return;
                    }
                    setError('Failed to remove card.');
                  } finally {
                    setShowRemoveConfirm(false);
                  }
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
