
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';

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
      const response = await axios.post(`${API_BASE}/note_tool/auth/login`, {
        email,
        password,
      });

      if (response.data.require2FA) {
        setMessage(response.data.message || '請輸入兩步驟驗證碼。');
        setMessageType('success');
        localStorage.setItem('userId', response.data.userId);
        setTimeout(() => {
          router.push('/auth/verify');
        }, 1500);
        return;
      }

      if (response.data.token) {
        setMessage(response.data.message || 'Login successful! Redirecting to 2FA setup...');
        setMessageType('success');
        localStorage.setItem('token', response.data.token);
        if (response.data.userId) {
          localStorage.setItem('userId', response.data.userId);
        }
        setTimeout(() => {
          router.push('/auth/2fa-setup');
        }, 2000);
        return;
      }

      setMessage(response.data.message || 'Login failed. Invalid email or password.');
      setMessageType('error');
    } catch (error: any) {
      console.error('Login API error:', error);
      const errorMessage = error.response?.data?.message || 'An unexpected error occurred during login.';
      setMessage(errorMessage);
      setMessageType('error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">Login</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Login
            </button>
          </div>
        </form>
        {message && (
          <div
            className={`p-3 rounded-md text-center ${
              messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </div>
        )}
        <p className="text-sm text-center text-gray-600">
          Don't have an account?{' '}
          <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
