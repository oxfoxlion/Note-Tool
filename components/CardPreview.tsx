import type { Card } from '../lib/noteToolApi';

type CardPreviewProps = {
  card: Card;
  previewLength: number;
  onSelect: () => void;
};

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

export default function CardPreview({ card, previewLength, onSelect }: CardPreviewProps) {
  const content = card.content ?? '';
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-sm font-semibold text-slate-900">{card.title}</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        {content ? truncate(content, previewLength) : 'No content yet.'}
      </p>
    </button>
  );
}
