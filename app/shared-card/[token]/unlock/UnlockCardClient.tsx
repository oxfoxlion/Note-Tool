'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { unlockSharedCard } from '../../../../lib/noteToolApi';

type UnlockCardClientProps = {
  token: string;
};

export default function UnlockCardClient({ token }: UnlockCardClientProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError('Please enter password.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      await unlockSharedCard(token, password);
      router.replace(`/shared-card/${encodeURIComponent(token)}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Unlock failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Protected Link</div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Enter password</h1>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Checking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
