'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../../../lib/markdownSanitize';
import { Card, getSharedCardByToken } from '../../../lib/noteToolApi';
import StatusPage from '../../../components/StatusPage';

type SharedCardClientProps = {
  token: string;
};

export default function SharedCardClient({ token }: SharedCardClientProps) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [errorKind, setErrorKind] = useState<'not_found' | 'expired' | 'unknown' | ''>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSharedCardByToken(token);
        setCard(data.card);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (status === 403 && code === 'PASSWORD_REQUIRED') {
          router.replace(`/shared-card/${encodeURIComponent(token)}/unlock`);
          return;
        }
        if (status === 404) {
          setErrorKind('not_found');
          return;
        }
        if (status === 410) {
          setErrorKind('expired');
          return;
        }
        setErrorKind('unknown');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      void load();
    }
  }, [router, token]);

  useEffect(() => {
    const title = card?.title?.trim() || 'Shared Card';
    document.title = `${title} | Mipun | Shao`;
  }, [card?.title]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  if (errorKind === 'not_found') {
    return <StatusPage code="404" title="Share link not found" description="This share link does not exist." />;
  }

  if (errorKind === 'expired') {
    return (
      <StatusPage
        code="410"
        title="Share link expired"
        description="This share link has expired or is no longer available."
      />
    );
  }

  if (errorKind === 'unknown') {
    return <StatusPage title="Unable to open link" description="Failed to open this share link. Please try again later." />;
  }

  if (!card) {
    return <StatusPage code="404" title="Card not found" description="The shared card could not be found." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <div className="mb-6 text-xs uppercase tracking-[0.2em] text-slate-400">Shared card</div>
        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">{card.title || 'Untitled'}</h1>
        <article className="prose mt-8 max-w-none text-sm leading-relaxed text-slate-700">
          <MDEditor.Markdown
            source={card.content || 'No content yet.'}
            wrapperElement={{ 'data-color-mode': 'light' }}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
          />
        </article>
      </div>
    </div>
  );
}
