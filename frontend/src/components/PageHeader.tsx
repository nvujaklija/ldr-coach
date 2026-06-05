/** Consistent title + subtitle block at the top of each feature screen. */
export default function PageHeader({
  title,
  subtitle,
  soon,
}: {
  title: string;
  subtitle?: string;
  soon?: boolean;
}) {
  return (
    <header className="page-header">
      <h1>
        {title}
        {soon && <span className="badge-soon">Coming soon</span>}
      </h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
