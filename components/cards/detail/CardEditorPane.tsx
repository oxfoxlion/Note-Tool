'use client';

import { Card } from '../../../lib/noteToolApi';
import CardEditorToolbar, { CardEditorToolbarProps } from './CardEditorToolbar';
import CardMarkdownEditor from './CardMarkdownEditor';
import CardMentionPicker from './CardMentionPicker';
import { RefObject } from 'react';

type CardEditorPaneProps = {
  toolbarActions: CardEditorToolbarProps;
  content: string;
  onChange: (next: string, textarea?: HTMLTextAreaElement | null) => void;
  onFocus: (textarea: HTMLTextAreaElement) => void;
  onBlur: () => void;
  mentionOpen: boolean;
  mentionCards: Card[];
  mentionCurrentCardId: number;
  mentionQuery: string;
  mentionPosition: { top: number; left: number };
  mentionMenuRef: RefObject<HTMLDivElement | null>;
  onMentionSelect: (item: Card) => void;
  isSaving: boolean;
};

export default function CardEditorPane({
  toolbarActions,
  content,
  onChange,
  onFocus,
  onBlur,
  mentionOpen,
  mentionCards,
  mentionCurrentCardId,
  mentionQuery,
  mentionPosition,
  mentionMenuRef,
  onMentionSelect,
  isSaving,
}: CardEditorPaneProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <CardEditorToolbar {...toolbarActions} />
      <div className="relative flex-1 min-h-0 overflow-visible">
        <CardMarkdownEditor value={content} onChange={onChange} onFocus={onFocus} onBlur={onBlur} />
        <CardMentionPicker
          open={mentionOpen}
          cards={mentionCards}
          currentCardId={mentionCurrentCardId}
          query={mentionQuery}
          position={mentionPosition}
          menuRef={mentionMenuRef}
          onSelect={onMentionSelect}
        />
      </div>
      <div className="flex justify-end text-xs text-slate-500">{isSaving ? 'Saving…' : 'Autosave on'}</div>
    </div>
  );
}
