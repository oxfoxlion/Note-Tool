'use client';

import { Card } from '../../../lib/noteToolApi';
import LinkedCardsList from './LinkedCardsList';
import CardMarkdownPreview from './CardMarkdownPreview';

type CardPreviewPaneProps = {
  content: string;
  linkedCards: Card[];
  onToggleTaskAtIndex: (index: number) => void;
  onOpenCard: (id: number) => void;
  scrollPaddingClassName?: string;
};

export default function CardPreviewPane({
  content,
  linkedCards,
  onToggleTaskAtIndex,
  onOpenCard,
  scrollPaddingClassName,
}: CardPreviewPaneProps) {
  return (
    <div className="flex min-h-0 flex-col gap-6">
      <article
        className={`prose max-w-none min-h-0 overflow-y-auto text-sm leading-relaxed text-slate-700 ${scrollPaddingClassName ?? ''}`}
      >
        <CardMarkdownPreview
          text={content || 'No content yet.'}
          onToggleTaskAtIndex={onToggleTaskAtIndex}
          onOpenCard={onOpenCard}
        />
      </article>
      <LinkedCardsList cards={linkedCards} onOpenCard={onOpenCard} />
    </div>
  );
}
