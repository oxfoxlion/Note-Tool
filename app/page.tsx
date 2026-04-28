
'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Button } from '../components/ui/button';
import ThemeToggle from '../components/theme/ThemeToggle';

export default function Home() {
  const hasToken = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }
      const handleChange = () => onStoreChange();
      window.addEventListener('storage', handleChange);
      window.addEventListener('focus', handleChange);
      return () => {
        window.removeEventListener('storage', handleChange);
        window.removeEventListener('focus', handleChange);
      };
    },
    () => {
      if (typeof window === 'undefined') return false;
      return Boolean(localStorage.getItem('note_tool_token') || '');
    },
    () => false
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-sm font-semibold tracking-wide">Note-Tool</div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-9 w-9 rounded-full" />
          <Button asChild>
            <Link href={hasToken ? '/boards' : '/auth/login'}>
              {hasToken ? '進入工作區' : '登入'}
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-10 md:pt-20">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            用卡片與白板整理你的想法與任務
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">
            Note-Tool 提供 Card Box 與 Board 兩種工作視圖，讓你可以快速記錄、關聯與追蹤重點內容。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Card Box</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              以卡片為核心保存筆記，支援搜尋、標籤與表格檢視，快速找到需要的內容。
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Board</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              將卡片放到白板視覺化整理，透過空間與連結建立更清楚的脈絡。
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Space</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              用 Space 區分專案與情境，讓不同主題的卡片與白板維持清楚邊界。
            </p>
          </article>
        </div>

        <div>
          <Button asChild size="lg">
            <Link href={hasToken ? '/boards' : '/auth/login'}>
              {hasToken ? '進入 Note-Tool' : '立即登入開始使用'}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
