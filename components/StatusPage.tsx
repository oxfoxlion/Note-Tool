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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {code && <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{code}</div>}
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
