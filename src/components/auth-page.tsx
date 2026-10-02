/** An inside page of the book, laid on the cover: ruled header, then the form. */
export function AuthPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full border border-cover-ink bg-page text-ink">
      <header className="rule-double px-6 pt-5 pb-3">
        <h1 className="font-stamp text-[28px] font-semibold uppercase leading-none tracking-[0.02em]">{title}</h1>
      </header>
      <div className="px-6 pt-5 pb-6">{children}</div>
    </section>
  );
}
