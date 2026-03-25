'use client';

import { Space } from '../../lib/noteToolApi';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';

type CardCopyToSpaceModalProps = {
  open: boolean;
  cardTitle: string;
  spaces: Space[];
  currentSpaceId: number | null;
  busySpaceId: number | null;
  error: string;
  successMessage: string;
  onClose: () => void;
  onCopy: (spaceId: number) => Promise<void> | void;
};

export default function CardCopyToSpaceModal({
  open,
  cardTitle,
  spaces,
  currentSpaceId,
  busySpaceId,
  error,
  successMessage,
  onClose,
  onCopy,
}: CardCopyToSpaceModalProps) {
  if (!open) return null;

  const targetSpaces = spaces.filter((space) => space.id !== currentSpaceId);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cardTitle}</DialogTitle>
          <DialogDescription>Create a duplicate of this card in another space.</DialogDescription>
        </DialogHeader>
        {error && <div className="text-xs text-rose-600">{error}</div>}
        {successMessage && <div className="text-xs text-emerald-600">{successMessage}</div>}
        <ScrollArea className="max-h-64">
          <div className="space-y-2 pr-4">
          {targetSpaces.map((space) => (
            <Button
              key={space.id}
              type="button"
              onClick={() => void onCopy(space.id)}
              disabled={busySpaceId === space.id}
              variant="outline"
              className="flex h-auto w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="truncate">
                {space.name}
                {space.is_default ? ' (Default)' : ''}
              </span>
              <span className="text-xs text-slate-400">{busySpaceId === space.id ? 'Copying...' : `#${space.id}`}</span>
            </Button>
          ))}
          {targetSpaces.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No other spaces available.
            </div>
          )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
