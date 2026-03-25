
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

export default function RegisterPage() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    const id = crypto.randomUUID();
    const email = (event.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    const displayName = (event.currentTarget.elements.namedItem('displayName') as HTMLInputElement).value;
    const password = (event.currentTarget.elements.namedItem('password') as HTMLInputElement).value;

    if (!email || !displayName || !password) {
      setMessage('Please fill out all fields.');
      setMessageType('error');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/note_tool/auth/register`,
        {
          id,
          email,
          displayName,
          password,
        },
        { withCredentials: true }
      );

      if (response.status >= 200 && response.status < 300) {
        setMessage(response.data.message || 'Registration successful! Redirecting to login...');
        setMessageType('success');
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        setMessage(response.data.message || 'Registration failed. Please try again.');
        setMessageType('error');
      }
    } catch (error: unknown) {
      console.error('Registration API error:', error);
      setMessage(getApiErrorMessage(error, 'An unexpected error occurred during registration.'));
      setMessageType('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card shadow-md">
        <CardContent className="space-y-6 p-8">
        <h1 className="text-center text-2xl font-bold text-card-foreground">Register</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
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
            <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
              Display Name
            </label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" aria-label="Password" className="block text-sm font-medium text-foreground">
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
              Register
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
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-foreground hover:text-muted-foreground">
            Login
          </Link>
        </p>
        </CardContent>
      </Card>
    </div>
  );
}
