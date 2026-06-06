import Link from "next/link";

/** Friendly, illustration-light empty state used across feature screens. */
export default function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <Link href={action.href}>
          <button type="button">{action.label}</button>
        </Link>
      )}
    </div>
  );
}
