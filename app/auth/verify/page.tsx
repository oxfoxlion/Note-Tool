'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import ThemeToggle from '../../../components/theme/ThemeToggle';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
  }
  return fallback;
}

export default function VerifyPage() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    const token = (event.currentTarget.elements.namedItem('token') as HTMLInputElement).value;
    const userId = localStorage.getItem('userId');

    if (!token) {
      setMessage('Please provide the verification code.');
      setMessageType('error');
      return;
    }

    if (!userId) {
      setMessage('User ID not found. Please log in again.');
      setMessageType('error');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/note_tool/auth/2fa/verify`,
        {
          userId,
          token,
        },
        { withCredentials: true }
      );

      if (response.data.token) {
        setMessage(response.data.message || 'Verification successful! Redirecting to dashboard...');
        setMessageType('success');
        localStorage.setItem('note_tool_token', response.data.token);
        if (typeof response.data.displayName === 'string') {
          localStorage.setItem('note_tool_display_name', response.data.displayName);
        }
        localStorage.removeItem('userId');
        setTimeout(() => {
          router.push('/boards');
        }, 2000);
      } else {
        setMessage(response.data.message || 'Verification failed. Invalid code.');
        setMessageType('error');
      }
    } catch (error: unknown) {
      console.error('2FA API error:', error);
      setMessage(getApiErrorMessage(error, 'An unexpected error occurred during verification.'));
      setMessageType('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card shadow-md">
        <CardContent className="space-y-6 p-8">
        <h1 className="text-center text-2xl font-bold text-card-foreground">Two-Step Verification</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-foreground">
              Verification Code
            </label>
            <Input
              id="token"
              name="token"
              type="text"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Button type="submit" className="w-full">
              Verify
            </Button>
          </div>
        </form>
        {message && (
          <div
            className={`rounded-md p-3 text-center text-sm ${
              messageType === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {message}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
