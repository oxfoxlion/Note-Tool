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

export default function DiscordCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('正在完成 Discord 登入...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finalizeDiscordLogin() {
      const redirectTo = sanitizeRedirectPath(searchParams.get('redirect_to'));
      const oauthError = searchParams.get('oauth_error');
      const oauthErrorMessage = searchParams.get('oauth_error_message');
      const linked = searchParams.get('linked') === '1';
      const require2FA = searchParams.get('require_2fa') === '1';
      const userId = searchParams.get('user_id');
      const displayName = searchParams.get('display_name');
      const callbackToken = searchParams.get('token');

      if (oauthError) {
        setError(oauthErrorMessage || 'Discord 登入失敗，請稍後再試。');
        return;
      }

      if (linked) {
        setMessage('Discord 帳號綁定成功，正在返回設定頁...');
        router.replace(redirectTo);
        return;
      }

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
        if (!token || typeof token !== 'string') {
          const response = await axios.post(
            `${API_BASE}/note_tool/auth/refresh`,
            {},
            { withCredentials: true }
          );
          token = response.data?.token;
        }

        if (!token || typeof token !== 'string') {
          throw new Error('Discord callback missing token');
        }

        localStorage.setItem('note_tool_token', token);
        localStorage.removeItem('userId');

        if (!cancelled) {
          setMessage('Discord 登入成功，正在前往工作區...');
          router.replace(redirectTo);
        }
      } catch (err) {
        console.error('Discord callback finalize error:', err);
        if (!cancelled) {
          setError('Discord 登入完成，但無法建立前端登入狀態，請重新登入。');
        }
      }
    }

    void finalizeDiscordLogin();

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
