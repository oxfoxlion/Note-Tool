'use client';

import { CardShareLink } from '../../lib/noteToolApi';

type CardShareLinksModalProps = {
  open: boolean;
  links: CardShareLink[];
  busy: boolean;
  error: string;
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
  toShareUrl,
  onClose,
  onCreate,
  onCopy,
  onRevoke,
}: CardShareLinksModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Share</div>
            <div className="text-lg font-semibold text-slate-900">Card share links</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Close"
            title="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Create a public view link for this card.</div>
            <button
              type="button"
              onClick={onCreate}
              disabled={busy}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Create link
            </button>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {links.map((link) => {
              const shareUrl = toShareUrl(link.token);
              const isRevoked = !!link.revoked_at;
              const isExpired = !!link.expires_at && new Date(link.expires_at) < new Date();
              return (
                <div key={link.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="text-xs font-medium text-slate-500">{shareUrl}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="rounded-full border border-slate-300 px-2 py-0.5 text-slate-600">{link.permission}</span>
                      {isRevoked && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">revoked</span>
                      )}
                      {!isRevoked && isExpired && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">expired</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onCopy(shareUrl)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Copy
                      </button>
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => void onRevoke(link.id)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Revoke
                        </button>
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
        </div>
      </div>
    </div>
  );
}
