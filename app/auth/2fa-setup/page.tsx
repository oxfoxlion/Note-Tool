'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';
import Link from 'next/link';

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
      } catch (error: any) {
        console.error('2FA Setup error:', error);
        if (error?.response?.status === 401) {
          setMessage('You are not logged in.');
          setMessageType('error');
          return;
        }
        const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
        setMessage(errorMessage);
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md p-8 space-y-6 text-center bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-900">Set Up Two-Factor Authentication</h1>
        {message && (
          <div
            className={`p-3 rounded-md ${
              messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </div>
        )}
        {qrCodeUrl && (
          <div className="flex justify-center">
            <img src={qrCodeUrl} alt="2FA QR Code" className="h-auto w-52 max-w-full sm:w-64" />
          </div>
        )}
        {authAppUrl && (
          <div className="flex flex-col items-center gap-2">
            <a
              href={authAppUrl}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Open Authenticator App
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200"
            >
              Copy setup link
            </button>
            {copyMessage && <div className="text-xs text-gray-600">{copyMessage}</div>}
          </div>
        )}
        <p className="text-sm text-gray-600">
          After scanning,{' '}
          <Link href="/auth/verify" className="font-medium text-indigo-600 hover:text-indigo-500">
            proceed to verify
          </Link>
          .
        </p>
        <p className="text-sm text-gray-600">
          Not now?{' '}
          <Link href="/boards" className="font-medium text-indigo-600 hover:text-indigo-500">
            Skip for now
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
