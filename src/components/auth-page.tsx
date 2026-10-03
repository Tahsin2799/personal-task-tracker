export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="auth-form-page">
      <h1>{title}</h1>
      {description && <p className="auth-intro">{description}</p>}
      {children}
    </section>
  );
}
