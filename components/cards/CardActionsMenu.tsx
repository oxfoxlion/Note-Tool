'use client';

import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

type CardAction = {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
};

type CardActionsMenuProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  actions: CardAction[];
  align?: 'left' | 'right';
  showTrigger?: boolean;
};

export default function CardActionsMenu({
  open,
  onToggle,
  onClose,
  actions,
  align = 'right',
  showTrigger = true,
}: CardActionsMenuProps) {
  const contentAlign = align === 'left' ? 'start' : 'end';

  return (
    <DropdownMenu open={open} onOpenChange={(next) => (next ? onToggle() : onClose())}>
      {showTrigger && (
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Card actions"
            title="Card actions"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="17.5" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={contentAlign} className="w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onClick={action.onClick}
            className={action.tone === 'danger' ? 'text-rose-600 focus:text-rose-600' : undefined}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
