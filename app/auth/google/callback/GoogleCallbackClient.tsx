'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

import { API_BASE } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';

function sanitizeRedirectPath(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return '/boards';
  }

  return path;
}

export default function GoogleCallbackClient() {
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
      const callbackToken = searchParams.get('token');

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
        let token = callbackToken;

        // 優先使用 callback query token，避免跨站 refresh cookie 在部分環境無法即時帶上的問題。
        if (!token || typeof token !== 'string') {
          const response = await axios.post(
            `${API_BASE}/note_tool/auth/refresh`,
            {},
            { withCredentials: true }
          );
          token = response.data?.token;
        }

        if (!token || typeof token !== 'string') {
          throw new Error('Google callback missing token');
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

  if (error) {
    return (
      <>
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</div>
        <Button className="w-full" onClick={() => router.replace('/auth/login')}>
          Back to login
        </Button>
      </>
    );
  }

  return <div className="rounded-md bg-emerald-500/10 p-3 text-center text-sm text-emerald-600">{message}</div>;
}
