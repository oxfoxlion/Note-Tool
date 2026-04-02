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
import { Card as UiCard, CardContent } from '../../../components/ui/card';
import ThemeToggle from '../../../components/theme/ThemeToggle';

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
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
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
    <div className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-12">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <UiCard className="mx-auto w-full max-w-4xl rounded-2xl border-border bg-card shadow-sm">
        <CardContent className="p-6 md:p-10">
        <div className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Shared card</div>
        <h1 className="text-2xl font-semibold text-card-foreground md:text-3xl">{card.title || 'Untitled'}</h1>
        <article className="card-preview-surface prose mt-8 max-w-none text-sm leading-relaxed text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-strong:text-card-foreground prose-code:text-card-foreground prose-pre:bg-muted prose-pre:text-card-foreground prose-li:text-card-foreground prose-blockquote:text-muted-foreground prose-a:text-card-foreground">
          <MDEditor.Markdown
            source={card.content || 'No content yet.'}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
          />
        </article>
        </CardContent>
      </UiCard>
    </div>
  );
}
