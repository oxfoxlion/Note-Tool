'use client';

import { BoardSummary } from '../../lib/noteToolApi';

type CardRemoveFromBoardModalProps = {
  open: boolean;
  cardTitle: string;
  boards: BoardSummary[];
  busyBoardId: number | null;
  error: string;
  onClose: () => void;
  onRemove: (boardId: number) => Promise<void> | void;
};

export default function CardRemoveFromBoardModal({
  open,
  cardTitle,
  boards,
  busyBoardId,
  error,
  onClose,
  onRemove,
}: CardRemoveFromBoardModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Remove from board</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{cardTitle}</h3>
        <p className="mt-2 text-sm text-slate-600">Choose which board to remove this card from.</p>
        {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() => void onRemove(board.id)}
              disabled={busyBoardId === board.id}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="truncate">{board.name}</span>
              <span className="text-xs text-slate-400">{busyBoardId === board.id ? 'Removing…' : `#${board.id}`}</span>
            </button>
          ))}
          {boards.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              This card is not loaded in any board, so there is nothing to remove.
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
