'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../../../../lib/markdownSanitize';
import { Card, deleteCard, getCards, updateCard } from '../../../../lib/noteToolApi';

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params.id;
  const [card, setCard] = useState<Card | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'split'>('view');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string }>({ title: '', content: '' });
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const cards = await getCards();
        const found =
          cards.find((item) => String(item.id) === String(cardId)) || null;
        setCard(found);
        if (found) {
          setTitle(found.title);
          setContent(found.content ?? '');
          lastSavedRef.current = { title: found.title, content: found.content ?? '' };
        }
      } catch (err: any) {
        if (err?.message === 'NO_TOKEN') {
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
        {text}
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
            setContent(event.target.value);
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
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </div>

      {viewMode === 'split' ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-h-0 flex-col gap-4">
            {renderToolbar()}
            <div className="flex-1 min-h-0 overflow-y-auto">{renderEditor()}</div>
            <div className="flex justify-end text-xs text-slate-500">
              {isSaving ? 'Saving…' : 'Autosave on'}
            </div>
          </div>
          <div className="h-full w-px bg-slate-200" />
          <article className="prose max-w-none min-h-0 overflow-y-auto px-0 py-1 text-sm leading-relaxed text-slate-700">
            {renderMarkdown(content || 'No content yet.')}
          </article>
        </div>
      ) : viewMode === 'edit' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {renderToolbar()}
          <div className="flex-1 min-h-0 overflow-y-auto">{renderEditor()}</div>
          <div className="flex justify-end text-xs text-slate-500">
            {isSaving ? 'Saving…' : 'Autosave on'}
          </div>
        </div>
      ) : (
        <article className="prose max-w-none min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-slate-700">
          {renderMarkdown(content || 'No content yet.')}
        </article>
      )}
    </div>
  );
}
