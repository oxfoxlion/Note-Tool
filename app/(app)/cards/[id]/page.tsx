import { Suspense } from 'react';
import CardDetailClient from './CardDetailClient';

export default function CardDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <CardDetailClient />
    </Suspense>
  );
}
