'use client';

import { useEffect, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { createPortal } from 'react-dom';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../lib/markdownSanitize';
import type { Card } from '../lib/noteToolApi';

type CardCreateOverlayProps = {
  mode: 'modal' | 'sidepanel';
  onClose: () => void;
  onCreate: (payload: { title: string; content: string }) => Promise<void> | void;
  allCards?: Card[];
};

export default function CardCreateOverlay({
  mode,
  onClose,
  onCreate,
  allCards = [],
}: CardCreateOverlayProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);

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

  const prepareMarkdown = (text: string) =>
    text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '[@$2](/cards/$1)');

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
          input: ({ ...props }: any) => {
            if (props.type === 'checkbox') {
              const offset = Number(props?.node?.position?.start?.offset);
              const lineFromNode = Number(props?.node?.position?.start?.line);
              const fallbackTaskIndex = renderTaskIndex;
              renderTaskIndex += 1;
              return (
                <input
                  type="checkbox"
                  checked={Boolean(props.checked)}
                  disabled={false}
                  readOnly={false}
                  onChange={(event) => {
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
        className="[&_.w-md-editor]:min-h-[260px] [&_.w-md-editor]:overflow-hidden [&_.w-md-editor]:rounded-xl [&_.w-md-editor]:border-slate-200 [&_.w-md-editor]:bg-slate-50 [&_.w-md-editor-text]:text-sm [&_.w-md-editor-text-input]:text-sm [&_.w-md-editor-text-pre]:text-sm"
      >
        <MDEditor
          value={content}
          onChange={handleEditorChange}
          preview="edit"
          hideToolbar
          visibleDragbar={false}
          height={280}
          textareaProps={{
            ref: editorRef,
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

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await onCreate({ title: title.trim(), content: content.trim() });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

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

  const wrapperClass =
    mode === 'modal'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
      : 'fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl';

  const panelClass =
    mode === 'modal'
      ? 'w-full max-w-2xl rounded-2xl bg-white shadow-2xl'
      : 'h-full w-full overflow-y-auto';

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
      <div className={`relative ${panelClass}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">New Card</div>
            <div className="text-lg font-semibold text-slate-900">Create</div>
          </div>
          <div className="flex items-center gap-2">
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
                onClick={() => setViewMode('preview')}
                className={`rounded-full p-2 ${
                  viewMode === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
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
          <div className="space-y-4 px-6 py-5">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Card title"
            />
          {viewMode === 'preview' ? (
            <article className="prose max-w-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {renderMarkdown(content || 'No content yet.')}
            </article>
          ) : (
            <div className="space-y-4">
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
                        .filter((item) => item.title)
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
                      {allCards.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No cards available.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            {error ? <div className="text-xs text-rose-600">{error}</div> : <div />}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
            >
              {isSaving ? 'Creating...' : 'Create card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
