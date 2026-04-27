'use client';

import Link from 'next/link';

type StatusPageProps = {
  code?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export default function StatusPage({
  code,
  title,
  description,
  primaryHref = '/boards',
  primaryLabel = 'Go to boards',
  secondaryHref = '/',
  secondaryLabel = 'Back home',
}: StatusPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {code && <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{code}</div>}
        <h1 className="mt-3 text-2xl font-semibold text-card-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
