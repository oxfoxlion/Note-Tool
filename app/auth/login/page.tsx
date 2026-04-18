
'use client';

import Link from 'next/link';
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

export default function LoginPage() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    const email = (event.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    const password = (event.currentTarget.elements.namedItem('password') as HTMLInputElement).value;

    if (!email || !password) {
      setMessage('Please provide both email and password.');
      setMessageType('error');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/note_tool/auth/login`,
        {
          email,
          password,
        },
        { withCredentials: true }
      );

      if (response.data.require2FA) {
        setMessage(response.data.message || '請輸入兩步驟驗證碼。');
        setMessageType('success');
        localStorage.setItem('userId', response.data.userId);
        if (typeof response.data.displayName === 'string') {
          localStorage.setItem('note_tool_display_name', response.data.displayName);
        }
        setTimeout(() => {
          router.push('/auth/verify');
        }, 1500);
        return;
      }

      if (response.data.token) {
        setMessage(response.data.message || 'Login successful! Redirecting to boards...');
        setMessageType('success');
        localStorage.setItem('note_tool_token', response.data.token);
        if (response.data.userId) {
          localStorage.setItem('userId', response.data.userId);
        }
        if (typeof response.data.displayName === 'string') {
          localStorage.setItem('note_tool_display_name', response.data.displayName);
        }
        localStorage.removeItem('userId');
        setTimeout(() => {
          router.push('/boards');
        }, 1200);
        return;
      }

      setMessage(response.data.message || 'Login failed. Invalid email or password.');
      setMessageType('error');
    } catch (error: unknown) {
      console.error('Login API error:', error);
      setMessage(getApiErrorMessage(error, 'An unexpected error occurred during login.'));
      setMessageType('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card shadow-md">
        <CardContent className="space-y-6 p-8">
        <h1 className="text-center text-2xl font-bold text-card-foreground">Login</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Button asChild type="button" variant="outline" className="w-full">
              <a href={`${API_BASE}/note_tool/auth/google/start?redirect_to=%2Fboards`}>Continue with Google</a>
            </Button>
          </div>
          <div>
            <Button asChild type="button" variant="outline" className="w-full">
              <a href={`${API_BASE}/note_tool/auth/discord/start?redirect_to=%2Fboards`}>Continue with Discord</a>
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Button type="submit" className="w-full">
              Login
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
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-medium text-foreground hover:text-muted-foreground">
            Register
          </Link>
        </p>
        </CardContent>
      </Card>
    </div>
  );
}
