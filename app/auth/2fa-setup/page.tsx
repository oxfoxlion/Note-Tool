'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import ThemeToggle from '../../../components/theme/ThemeToggle';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
  }
  return fallback;
}

export default function Setup2FAPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [authAppUrl, setAuthAppUrl] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    const setup2FA = async () => {
      try {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem('note_tool_token') || '' : '';
        const response = await axios.post(
          `${API_BASE}/note_tool/auth/2fa/setup`,
          {},
          {
            withCredentials: true,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );

        if (response.data.qrCodeUrl) {
          const nextQrCodeUrl = response.data.qrCodeUrl;
          const nextAuthAppUrl =
            response.data.otpauthUrl || response.data.authAppUrl || response.data.setupUrl || '';

          setQrCodeUrl(nextQrCodeUrl);
          if (nextAuthAppUrl) {
            setAuthAppUrl(nextAuthAppUrl);
          } else if (typeof nextQrCodeUrl === 'string' && nextQrCodeUrl.startsWith('otpauth://')) {
            setAuthAppUrl(nextQrCodeUrl);
          }
          setMessage('Scan this QR code with your authenticator app.');
          setMessageType('success');
          if (response.data.userId) {
            localStorage.setItem('userId', response.data.userId);
          }
          return;
        }

        setMessage(response.data.message || 'Failed to set up 2FA.');
        setMessageType('error');
      } catch (error: unknown) {
        console.error('2FA Setup error:', error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setMessage('You are not logged in.');
          setMessageType('error');
          return;
        }
        setMessage(getApiErrorMessage(error, 'An unexpected error occurred.'));
        setMessageType('error');
      }
    };

    setup2FA();
  }, []);

  const handleCopy = async () => {
    if (!authAppUrl) return;
    try {
      await navigator.clipboard.writeText(authAppUrl);
      setCopyMessage('Link copied.');
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyMessage('Copy failed. Please copy manually.');
    }
    setTimeout(() => setCopyMessage(''), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card text-center shadow-md">
        <CardContent className="space-y-6 p-8">
        <h1 className="text-2xl font-bold text-card-foreground">Set Up Two-Factor Authentication</h1>
        {message && (
          <div
            className={`rounded-md p-3 text-sm ${
              messageType === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {message}
          </div>
        )}
        {qrCodeUrl && (
          <div className="flex justify-center">
            <Image
              src={qrCodeUrl}
              alt="2FA QR Code"
              width={256}
              height={256}
              unoptimized
              className="h-auto w-52 max-w-full sm:w-64"
            />
          </div>
        )}
        {authAppUrl && (
          <div className="flex flex-col items-center gap-2">
            <a
              href={authAppUrl}
              className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open Authenticator App
            </a>
            <Button type="button" variant="outline" onClick={handleCopy}>
              Copy setup link
            </Button>
            {copyMessage && <div className="text-xs text-muted-foreground">{copyMessage}</div>}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          After scanning,{' '}
          <Link href="/auth/verify" className="font-medium text-foreground hover:text-muted-foreground">
            proceed to verify
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Not now?{' '}
          <Link href="/boards" className="font-medium text-foreground hover:text-muted-foreground">
            Skip for now
          </Link>
          .
        </p>
        </CardContent>
      </Card>
    </div>
  );
}
