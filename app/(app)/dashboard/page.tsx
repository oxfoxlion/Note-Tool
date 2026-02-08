
export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white/80 p-8 shadow-sm backdrop-blur">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Workspace</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-2 text-slate-600">
          Your notes are ready. Jump into the card box or sketch ideas on a board.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Card Box</h2>
          <p className="mt-2 text-sm text-slate-600">
            Capture ideas quickly and keep everything searchable.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Boards</h2>
          <p className="mt-2 text-sm text-slate-600">
            Organize cards visually and create focused collections.
          </p>
        </div>
      </section>
    </div>
  );
}
