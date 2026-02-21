import type { Metadata } from 'next';
import { API_BASE } from '../../../lib/api';

type SharedBoardMetaPayload = {
  isPasswordProtected?: boolean;
  title?: string | null;
  description?: string | null;
};

async function fetchSharedBoardMeta(token: string): Promise<SharedBoardMetaPayload | null> {
  try {
    const response = await fetch(`${API_BASE}/note_tool/board/share/${encodeURIComponent(token)}/meta`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as SharedBoardMetaPayload;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await fetchSharedBoardMeta(params.token);
  const boardName = data?.title?.trim() || 'Shared Board';
  const description = data?.description?.trim() || 'Connect the Mind, Punch the Memory.';
  const isPasswordProtected = Boolean(data?.isPasswordProtected);

  return {
    title: `${boardName} | Mipun | Shao`,
    description,
    robots: isPasswordProtected
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export default function SharedBoardTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
