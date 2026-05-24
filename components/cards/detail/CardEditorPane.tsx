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
  mentionSpaceNameById?: Record<number, string>;
  mentionPosition: { top: number; left: number };
  mentionMenuRef: RefObject<HTMLDivElement | null>;
  onMentionSelect: (item: Card) => void;
  isSaving: boolean;
  hasPendingChanges: boolean;
  onSaveNow: () => void;
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
  mentionSpaceNameById = {},
  mentionPosition,
  mentionMenuRef,
  onMentionSelect,
  isSaving,
  hasPendingChanges,
  onSaveNow,
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
          spaceNameById={mentionSpaceNameById}
          position={mentionPosition}
          menuRef={mentionMenuRef}
          onSelect={onMentionSelect}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{isSaving ? 'Saving…' : 'Autosave on'}</span>
        <button
          type="button"
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-card-foreground transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSaveNow}
          disabled={isSaving || !hasPendingChanges}
        >
          儲存
        </button>
      </div>
    </div>
  );
}
