'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCardDetailState } from '../../../../hooks/useCardDetailState';
import { useCardLinks } from '../../../../hooks/useCardLinks';
import { useCardActions } from '../../../../hooks/useCardActions';
import CardActionsMenu from '../../../../components/cards/CardActionsMenu';
import CardShareLinksModal from '../../../../components/cards/CardShareLinksModal';
import CardRemoveFromBoardModal from '../../../../components/cards/CardRemoveFromBoardModal';
import CardEditorPane from '../../../../components/cards/detail/CardEditorPane';
import CardPreviewPane from '../../../../components/cards/detail/CardPreviewPane';
import CardViewModeSwitch from '../../../../components/cards/detail/CardViewModeSwitch';
import { CardEditorToolbarProps } from '../../../../components/cards/detail/CardEditorToolbar';
import { useCardMentions } from '../../../../hooks/useCardMentions';
import { useMarkdownEditorTools } from '../../../../hooks/useMarkdownEditorTools';

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = params.id;
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'split'>('view');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const activeViewMode = isMobile && viewMode === 'split' ? 'view' : viewMode;

  const boardId = useMemo(() => {
    const raw = searchParams.get('boardId');
    const parsed = raw ? Number(raw) : null;
    return Number.isFinite(parsed) ? (parsed as number) : null;
  }, [searchParams]);

  const { card, allCards, title, setTitle, content, setContent, isSaving, error } = useCardDetailState({
    cardId,
    autosaveEnabled: activeViewMode !== 'view',
    onUnauthorized: () => router.push('/auth/login'),
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const markdownTools = useMarkdownEditorTools({ content, setContent, editorRef });
  const mentions = useCardMentions({ content, setContent, editorRef });
  const linkedCards = useCardLinks({ allCards, content, cardId: card?.id });
  const { actionItems, share, removeMembership, handleRemoveFromBoard, handleCopyShareUrl } = useCardActions({
    card,
    boardId,
    closeMenu: () => setShowCardMenu(false),
    onUnauthorized: () => router.push('/auth/login'),
    onDeleted: () => router.push('/cards'),
    onNavigateBoard: (targetBoardId) => router.push(`/boards/${targetBoardId}`),
  });

  const toolbarActions: CardEditorToolbarProps = {
    onHeading: markdownTools.incrementHeading,
    onBold: () => markdownTools.wrapSelection('**'),
    onItalic: () => markdownTools.wrapSelection('*'),
    onUnderline: () => markdownTools.wrapSelection('<u>', '</u>'),
    onStrikethrough: () => markdownTools.wrapSelection('~~'),
    onInlineCode: () => markdownTools.wrapSelection('`'),
    onBulletedList: () => markdownTools.insertLinePrefix('- '),
    onNumberedList: markdownTools.insertOrderedList,
    onQuote: () => markdownTools.insertLinePrefix('> '),
    onCheckbox: () => markdownTools.insertLinePrefix('- [ ] '),
    onTable: () => markdownTools.insertBlock('\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n'),
    onLink: () => markdownTools.wrapSelection('[', '](url)'),
    onImage: () => markdownTools.insertBlock('\n![image](https://example.png)\n'),
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
          <CardViewModeSwitch isMobile={isMobile} viewMode={activeViewMode} onChange={setViewMode} />
          <CardActionsMenu
            open={showCardMenu}
            onToggle={() => setShowCardMenu((prev) => !prev)}
            onClose={() => setShowCardMenu(false)}
            actions={actionItems}
          />
        </div>
      </div>

      {activeViewMode === 'split' ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <CardEditorPane
            toolbarActions={toolbarActions}
            content={content}
            onChange={mentions.handleEditorChange}
            onFocus={mentions.handleEditorFocus}
            onBlur={mentions.handleEditorBlur}
            mentionOpen={mentions.showMentions}
            mentionCards={allCards}
            mentionCurrentCardId={card.id}
            mentionQuery={mentions.mentionQuery}
            mentionPosition={mentions.mentionPos}
            mentionMenuRef={mentions.mentionMenuRef}
            onMentionSelect={mentions.handleMentionSelect}
            isSaving={isSaving}
          />
          <div className="h-full w-px bg-slate-200" />
          <CardPreviewPane
            content={content}
            linkedCards={linkedCards}
            onToggleTaskAtIndex={markdownTools.toggleTaskAtIndex}
            onOpenCard={(id) => router.push(`/cards/${id}`)}
            scrollPaddingClassName="px-0 py-1"
          />
        </div>
      ) : activeViewMode === 'edit' ? (
        <CardEditorPane
          toolbarActions={toolbarActions}
          content={content}
          onChange={mentions.handleEditorChange}
          onFocus={mentions.handleEditorFocus}
          onBlur={mentions.handleEditorBlur}
          mentionOpen={mentions.showMentions}
          mentionCards={allCards}
          mentionCurrentCardId={card.id}
          mentionQuery={mentions.mentionQuery}
          mentionPosition={mentions.mentionPos}
          mentionMenuRef={mentions.mentionMenuRef}
          onMentionSelect={mentions.handleMentionSelect}
          isSaving={isSaving}
        />
      ) : (
        <CardPreviewPane
          content={content}
          linkedCards={linkedCards}
          onToggleTaskAtIndex={markdownTools.toggleTaskAtIndex}
          onOpenCard={(id) => router.push(`/cards/${id}`)}
        />
      )}

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
        onCopy={handleCopyShareUrl}
        onRevoke={share.revokeShareLink}
      />

      {card && (
        <CardRemoveFromBoardModal
          open={removeMembership.showRemovePicker}
          cardTitle={card.title}
          boards={removeMembership.removeBoards}
          busyBoardId={removeMembership.removeBusyBoardId}
          error={removeMembership.removeError}
          onClose={removeMembership.closeRemovePicker}
          onRemove={handleRemoveFromBoard}
        />
      )}
    </div>
  );
}
