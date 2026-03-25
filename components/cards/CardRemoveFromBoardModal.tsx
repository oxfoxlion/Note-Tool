'use client';

import { BoardSummary } from '../../lib/noteToolApi';
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
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cardTitle}</DialogTitle>
          <DialogDescription>Choose which board to remove this card from.</DialogDescription>
        </DialogHeader>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <ScrollArea className="max-h-64">
          <div className="space-y-2 pr-4">
          {boards.map((board) => (
            <Button
              key={board.id}
              type="button"
              onClick={() => void onRemove(board.id)}
              disabled={busyBoardId === board.id}
              variant="outline"
              className="flex h-auto w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-left text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
            >
              <span className="truncate">{board.name}</span>
              <span className="text-xs text-muted-foreground">{busyBoardId === board.id ? 'Removing…' : `#${board.id}`}</span>
            </Button>
          ))}
          {boards.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              This card is not loaded in any board, so there is nothing to remove.
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
