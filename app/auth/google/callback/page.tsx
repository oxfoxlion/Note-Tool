'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

import { API_BASE } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import ThemeToggle from '../../../../components/theme/ThemeToggle';

function sanitizeRedirectPath(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return '/boards';
  }

  return path;
}

export default function NoteToolGoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('正在完成 Google 登入...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finalizeGoogleLogin() {
      const redirectTo = sanitizeRedirectPath(searchParams.get('redirect_to'));
      const require2FA = searchParams.get('require_2fa') === '1';
      const userId = searchParams.get('user_id');
      const displayName = searchParams.get('display_name');

      if (require2FA) {
        if (userId) {
          localStorage.setItem('userId', userId);
        }
        if (displayName) {
          localStorage.setItem('note_tool_display_name', displayName);
        }
        router.replace('/auth/verify');
        return;
      }

      try {
        const response = await axios.post(
          `${API_BASE}/note_tool/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const token = response.data?.token;
        if (!token || typeof token !== 'string') {
          throw new Error('Refresh token response missing token');
        }

        localStorage.setItem('note_tool_token', token);
        localStorage.removeItem('userId');

        if (!cancelled) {
          setMessage('Google 登入成功，正在前往工作區...');
          router.replace(redirectTo);
        }
      } catch (err) {
        console.error('Google callback finalize error:', err);
        if (!cancelled) {
          setError('Google 登入完成，但無法建立前端登入狀態，請重新登入。');
        }
      }
    }

    void finalizeGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card shadow-md">
        <CardContent className="space-y-6 p-8">
          <h1 className="text-center text-2xl font-bold text-card-foreground">Google Login</h1>
          {error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</div>
          ) : (
            <div className="rounded-md bg-emerald-500/10 p-3 text-center text-sm text-emerald-600">{message}</div>
          )}
          {error ? (
            <Button className="w-full" onClick={() => router.replace('/auth/login')}>
              Back to login
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
