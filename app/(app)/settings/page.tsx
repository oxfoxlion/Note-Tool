'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { disableTwoFactorAuth, getUserProfile, type UserProfile } from '../../../lib/noteToolApi';

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const maybeResponse = (err as { response?: { data?: { message?: string } } }).response;
    const message = maybeResponse?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const nextProfile = await getUserProfile();
        if (!active) return;
        setProfile(nextProfile);
      } catch (err: unknown) {
        if (!active) return;
        setError(getErrorMessage(err, 'Failed to load user settings.'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleEnable2FA = () => {
    router.push('/auth/2fa-setup');
  };

  const handleDisable2FA = async () => {
    if (!profile?.twoFactorEnabled) return;
    const confirmed = window.confirm('Disable two-factor authentication?');
    if (!confirmed) return;

    try {
      setBusy(true);
      setError('');
      setMessage('');
      await disableTwoFactorAuth();
      const nextProfile = await getUserProfile();
      setProfile(nextProfile);
      setMessage('Two-factor authentication is now disabled.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to disable two-factor authentication.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Settings</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Account & Security</h1>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">Nickname</div>
        <div className="mt-1 text-base font-medium text-slate-900">{profile?.displayName || 'N/A'}</div>
        <div className="mt-4 text-sm text-slate-500">Email</div>
        <div className="mt-1 text-base text-slate-900">{profile?.email || 'N/A'}</div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Two-Factor Authentication</h2>
            <p className="mt-2 text-sm text-slate-600">
              Status:{' '}
              <span className={profile?.twoFactorEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-700'}>
                {profile?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>

          {profile?.twoFactorEnabled ? (
            <button
              type="button"
              onClick={handleDisable2FA}
              disabled={busy}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
            >
              {busy ? 'Disabling...' : 'Disable 2FA'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable2FA}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Enable 2FA
            </button>
          )}
        </div>

        {!profile?.twoFactorEnabled && (
          <p className="mt-4 text-xs text-slate-500">
            Enabling 2FA will open setup flow where you scan a QR code and verify once to activate.
          </p>
        )}
      </section>

      <div className="mt-6">
        <Link href="/boards" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
          Back to boards
        </Link>
      </div>
    </div>
  );
}
