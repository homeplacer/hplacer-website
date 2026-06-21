export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-stone-line bg-stone-surface">
      <div className="container-x py-14">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-stone-muted">{children}</div>}
      </div>
    </section>
  );
}
