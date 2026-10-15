// Komponenty bazowe Ostoi. Tokeny kolorów: src/app/globals.css (@theme), zasady: docs/design-system.md.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "quiet" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark border border-brand",
  secondary: "bg-card text-brand border-[1.5px] border-brand hover:bg-brand-tint",
  quiet: "bg-transparent text-brand underline-offset-4 hover:underline border border-transparent",
  danger: "bg-card text-danger border-[1.5px] border-danger hover:bg-danger-tint",
};

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "primary",
  className,
  full,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; full?: boolean }) {
  return <button className={cx(base, variantClass[variant], full && "w-full", className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  full,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; full?: boolean }) {
  return <Link className={cx(base, variantClass[variant], full && "w-full", "no-underline", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-[14px] border border-line bg-card p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {aside ? <div className="text-sm text-muted">{aside}</div> : null}
    </div>
  );
}

type Tone = "brand" | "warn" | "neutral" | "danger" | "night";

const toneClass: Record<Tone, string> = {
  brand: "bg-brand-tint text-brand",
  warn: "bg-warn-tint text-warn-ink",
  neutral: "bg-ground text-muted",
  danger: "bg-danger-tint text-danger",
  night: "bg-night text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({ tone = "brand", title, children }: { tone?: "brand" | "warn" | "danger"; title?: string; children: ReactNode }) {
  const cls = tone === "warn" ? "bg-warn-tint text-warn-ink" : tone === "danger" ? "bg-danger-tint text-danger" : "bg-brand-tint text-brand-dark";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-[15px]", cls)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  id,
  children,
}: {
  label: string;
  hint?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "min-h-12 w-full rounded-[10px] border border-[#B8C0B9] bg-card px-3.5 text-[16px] text-ink placeholder:text-[#707C77]";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputBase, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "min-h-24 py-3", className)} {...props} />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#B8C0B9] bg-card px-5 py-8 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageTitle({ children, sub, aside }: { children: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-[30px] leading-tight">{children}</h1>
        {sub ? <p className="mt-1 text-muted">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
      {items.map((it) => (
        <div key={it.term} className="contents">
          <dt className="text-muted">{it.term}</dt>
          <dd className="font-semibold">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { cx };
