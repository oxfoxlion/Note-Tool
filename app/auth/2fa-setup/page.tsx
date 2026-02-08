'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../lib/api';
import Link from 'next/link';

export default function Setup2FAPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    const setup2FA = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('You are not logged in.');
        setMessageType('error');
        return;
      }

      try {
        const response = await axios.post(
          `${API_BASE}/note_tool/auth/2fa/setup`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.qrCodeUrl) {
          setQrCodeUrl(response.data.qrCodeUrl);
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
        const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
        setMessage(errorMessage);
        setMessageType('error');
      }
    };

    setup2FA();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
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
            <img src={qrCodeUrl} alt="2FA QR Code" />
          </div>
        )}
        <p className="text-sm text-gray-600">
          After scanning,{' '}
          <Link href="/auth/verify" className="font-medium text-indigo-600 hover:text-indigo-500">
            proceed to verify
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
