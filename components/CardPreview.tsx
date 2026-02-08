import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../lib/markdownSanitize';
import type { Card } from '../lib/noteToolApi';

type CardPreviewProps = {
  card: Card;
  previewLength?: number;
  renderMarkdown?: boolean;
  interactive?: boolean;
  fillHeight?: boolean;
  onSelect: () => void;
};

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function markdownToText(markdown: string) {
  let text = markdown;
  text = text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/[*_~]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export default function CardPreview({
  card,
  previewLength,
  renderMarkdown = false,
  interactive = true,
  fillHeight = false,
  onSelect,
}: CardPreviewProps) {
  const content = card.content ?? '';
  const compiled = markdownToText(content);
  const prepareMarkdown = (text: string) =>
    text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '[@$2](/cards/$1)');
  const previewText =
    typeof previewLength === 'number' ? (compiled ? truncate(compiled, previewLength) : '') : compiled;
  const body = (
    <>
      <div className="text-sm font-semibold text-slate-900">{card.title}</div>
      {renderMarkdown ? (
        <div
          className={`prose prose-sm mt-2 max-w-none overflow-x-auto overflow-y-auto text-slate-700 ${
            fillHeight ? 'h-full max-h-none' : 'max-h-[600px]'
          }`}
        >
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
              components={{
                input: ({ ...props }: any) =>
                  props.type === 'checkbox' ? (
                    <input type="checkbox" checked={Boolean(props.checked)} disabled readOnly />
                  ) : (
                    <input {...props} />
                  ),
              }}
            >
              {prepareMarkdown(content)}
            </ReactMarkdown>
          ) : (
            <p className="text-xs text-slate-500">No content yet.</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {previewText ? previewText : 'No content yet.'}
        </p>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div
        className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${
          fillHeight ? 'h-full' : ''
        }`}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        fillHeight ? 'h-full' : ''
      }`}
    >
      {body}
    </button>
  );
}
