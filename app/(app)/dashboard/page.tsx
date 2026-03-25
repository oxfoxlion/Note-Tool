export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-card/80 p-8 shadow-sm backdrop-blur">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Workspace</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-card-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your notes are ready. Jump into the card box or sketch ideas on a board.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Card Box</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Capture ideas quickly and keep everything searchable.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Boards</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize cards visually and create focused collections.
          </p>
        </div>
      </section>
    </div>
  );
}
