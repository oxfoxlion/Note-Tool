import type { Metadata } from 'next';
import UnlockCardClient from './UnlockCardClient';

export const metadata: Metadata = {
  title: 'Unlock Shared Card | Mipun | Shao',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SharedCardUnlockPage({ params }: { params: { token: string } }) {
  return <UnlockCardClient token={params.token} />;
}
