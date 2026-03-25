'use client';

import { Space } from '../../lib/noteToolApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

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
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Copy to space</div>
          <DialogTitle>{boardTitle}</DialogTitle>
          <DialogDescription>Duplicate this board and its cards into another space.</DialogDescription>
        </DialogHeader>
        {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
        {successMessage && <div className="mt-3 text-xs text-emerald-600">{successMessage}</div>}
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {targetSpaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => void onCopy(space.id)}
              disabled={busySpaceId === space.id}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
            >
              <span className="truncate">
                {space.name}
                {space.is_default ? ' (Default)' : ''}
              </span>
              <span className="text-xs text-muted-foreground">{busySpaceId === space.id ? 'Copying...' : `#${space.id}`}</span>
            </button>
          ))}
          {targetSpaces.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No other spaces available.
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
