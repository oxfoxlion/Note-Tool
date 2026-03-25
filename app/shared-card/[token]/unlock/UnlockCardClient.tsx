'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { unlockSharedCard } from '../../../../lib/noteToolApi';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import ThemeToggle from '../../../../components/theme/ThemeToggle';

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-sm rounded-2xl border-border bg-card shadow-sm">
        <CardContent className="p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Protected Link</div>
        <h1 className="mt-2 text-xl font-semibold text-card-foreground">Enter password</h1>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          {error && <div className="text-xs text-destructive">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Checking...' : 'Unlock'}
          </Button>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}
