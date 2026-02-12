'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';

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
        localStorage.removeItem('userId');
        setTimeout(() => {
          router.push('/boards');
        }, 2000);
      } else {
        setMessage(response.data.message || 'Verification failed. Invalid code.');
        setMessageType('error');
      }
    } catch (error: any) {
      console.error('2FA API error:', error);
      const errorMessage = error.response?.data?.message || 'An unexpected error occurred during verification.';
      setMessage(errorMessage);
      setMessageType('error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">Two-Step Verification</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              Verification Code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Verify
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
      </div>
    </div>
  );
}
