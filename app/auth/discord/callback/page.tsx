import { Suspense } from 'react';

import { Card, CardContent } from '../../../../components/ui/card';
import ThemeToggle from '../../../../components/theme/ThemeToggle';
import DiscordCallbackClient from './DiscordCallbackClient';

function LoadingState() {
  return (
    <div className="rounded-md bg-emerald-500/10 p-3 text-center text-sm text-emerald-600">
      正在完成 Discord 登入...
    </div>
  );
}

export default function NoteToolDiscordCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="fixed right-4 top-4 rounded-full" />
      <Card className="w-full max-w-md border-border bg-card shadow-md">
        <CardContent className="space-y-6 p-8">
          <h1 className="text-center text-2xl font-bold text-card-foreground">Discord Login</h1>
          <Suspense fallback={<LoadingState />}>
            <DiscordCallbackClient />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
