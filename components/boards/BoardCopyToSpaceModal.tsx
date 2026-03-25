'use client';

import { Space } from '../../lib/noteToolApi';

type BoardCopyToSpaceModalProps = {
  open: boolean;
  boardTitle: string;
  spaces: Space[];
  currentSpaceId?: number | null;
  busySpaceId: number | null;
  error: string;
  successMessage: string;
  onClose: () => void;
  onCopy: (spaceId: number) => Promise<void> | void;
};

export default function BoardCopyToSpaceModal({
  open,
  boardTitle,
  spaces,
  currentSpaceId,
  busySpaceId,
  error,
  successMessage,
  onClose,
  onCopy,
}: BoardCopyToSpaceModalProps) {
  if (!open) return null;

  const targetSpaces = spaces.filter((space) => space.id !== currentSpaceId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Copy to space</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{boardTitle}</h3>
        <p className="mt-2 text-sm text-slate-600">Duplicate this board and its cards into another space.</p>
        {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
        {successMessage && <div className="mt-3 text-xs text-emerald-600">{successMessage}</div>}
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {targetSpaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => void onCopy(space.id)}
              disabled={busySpaceId === space.id}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="truncate">
                {space.name}
                {space.is_default ? ' (Default)' : ''}
              </span>
              <span className="text-xs text-slate-400">{busySpaceId === space.id ? 'Copying...' : `#${space.id}`}</span>
            </button>
          ))}
          {targetSpaces.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No other spaces available.
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
