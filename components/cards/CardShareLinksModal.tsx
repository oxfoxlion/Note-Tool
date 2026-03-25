'use client';

import { useState } from 'react';
import { CardShareLink } from '../../lib/noteToolApi';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

type CardShareLinksModalProps = {
  open: boolean;
  links: CardShareLink[];
  busy: boolean;
  error: string;
  sharePassword: string;
  onSharePasswordChange: (value: string) => void;
  toShareUrl: (token: string) => string;
  onClose: () => void;
  onCreate: () => Promise<void> | void;
  onCopy: (url: string) => Promise<void> | void;
  onRevoke: (shareLinkId: number) => Promise<void> | void;
};

export default function CardShareLinksModal({
  open,
  links,
  busy,
  error,
  sharePassword,
  onSharePasswordChange,
  toShareUrl,
  onClose,
  onCreate,
  onCopy,
  onRevoke,
}: CardShareLinksModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Card share links</DialogTitle>
          <DialogDescription>Create and manage share links for this card.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Create a public view link for this card.</div>
            <Button
              type="button"
              onClick={onCreate}
              disabled={busy}
              size="sm"
            >
              Create link
            </Button>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={sharePassword}
              onChange={(event) => onSharePasswordChange(event.target.value)}
              minLength={6}
              maxLength={12}
              placeholder="Optional password (6-12 chars)"
              className="pr-10 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M3 5l16 16M10.6 10.6a3 3 0 104.2 4.2M9.9 5.2A11 11 0 0121 12a11.8 11.8 0 01-3.3 4.7M6.5 8A12 12 0 003 12a11.9 11.9 0 004.1 5.5A11.2 11.2 0 0012 19a10.9 10.9 0 003.1-.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              )}
            </Button>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <ScrollArea className="max-h-[45vh]">
            <div className="space-y-2 pr-4">
            {links.map((link) => {
              const shareUrl = toShareUrl(link.token);
              const isRevoked = !!link.revoked_at;
              const isExpired = !!link.expires_at && new Date(link.expires_at) < new Date();
              return (
                <div key={link.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="text-xs font-medium text-slate-500">{shareUrl}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <Badge variant="outline">{link.permission}</Badge>
                      {link.password_protected && (
                        <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
                          password
                        </Badge>
                      )}
                      {isRevoked && (
                        <Badge variant="secondary" className="border-rose-200 bg-rose-50 text-rose-600">
                          revoked
                        </Badge>
                      )}
                      {!isRevoked && isExpired && (
                        <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
                          expired
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => void onCopy(shareUrl)}
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px]"
                      >
                        Copy
                      </Button>
                      {!isRevoked && (
                        <Button
                          type="button"
                          onClick={() => void onRevoke(link.id)}
                          variant="outline"
                          size="sm"
                          className="h-8 border-rose-200 text-[11px] text-rose-600 hover:bg-rose-50"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {links.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No share links yet.
              </div>
            )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
