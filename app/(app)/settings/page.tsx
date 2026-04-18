'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { disableTwoFactorAuth, getUserProfile, type UserProfile } from '../../../lib/noteToolApi';
import { API_BASE } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';

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
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
        <h1 className="mt-2 text-2xl font-semibold text-card-foreground">Account & Security</h1>
      </div>

      {error && <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {message && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{message}</div>
      )}

      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground">Nickname</div>
          <div className="mt-1 text-base font-medium text-card-foreground">{profile?.displayName || 'N/A'}</div>
          <div className="mt-4 text-sm text-muted-foreground">Email</div>
          <div className="mt-1 text-base text-card-foreground">{profile?.email || 'N/A'}</div>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-2xl border-border bg-card shadow-sm">
        <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Two-Factor Authentication</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Status:{' '}
              <span className={profile?.twoFactorEnabled ? 'font-semibold text-emerald-600' : 'font-semibold text-card-foreground'}>
                {profile?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>

          {profile?.twoFactorEnabled ? (
            <Button type="button" variant="outline" onClick={handleDisable2FA} disabled={busy} className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              {busy ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          ) : (
            <Button type="button" onClick={handleEnable2FA}>
              Enable 2FA
            </Button>
          )}
        </div>

        {!profile?.twoFactorEnabled && (
          <p className="mt-4 text-xs text-muted-foreground">
            Enabling 2FA will open setup flow where you scan a QR code and verify once to activate.
          </p>
        )}
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-2xl border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-card-foreground">OAuth Providers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            已登入帳號可在此手動綁定 provider。系統不會因 email 相同而自動合併帳號。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button asChild type="button" variant="outline">
              <a href={`${API_BASE}/note_tool/auth/google/link/start?redirect_to=%2Fsettings`}>
                {profile?.googleLinked ? 'Reconnect Google' : 'Link Google'}
              </a>
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={`${API_BASE}/note_tool/auth/discord/link/start?redirect_to=%2Fsettings`}>
                {profile?.discordLinked ? 'Reconnect Discord' : 'Link Discord'}
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            目前狀態：Google {profile?.googleLinked ? '已連結' : '未連結'}，Discord{' '}
            {profile?.discordLinked ? '已連結' : '未連結'}。
          </p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Link href="/boards" className="text-sm font-medium text-foreground underline hover:text-muted-foreground">
          Back to boards
        </Link>
      </div>
    </div>
  );
}
