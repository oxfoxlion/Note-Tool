import type { Metadata } from 'next';
import UnlockBoardClient from './UnlockBoardClient';

export const metadata: Metadata = {
  title: 'Unlock Shared Board | Mipun | Shao',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SharedBoardUnlockPage({ params }: { params: { token: string } }) {
  return <UnlockBoardClient token={params.token} />;
}
