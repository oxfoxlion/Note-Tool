import { Suspense } from 'react';
import CardCreateClient from './CardCreateClient';

export default function CardCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
      <CardCreateClient />
    </Suspense>
  );
}
