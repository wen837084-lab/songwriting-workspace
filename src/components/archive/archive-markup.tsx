import type { ReactNode } from "react";

interface ArchiveMetaProps {
  children: ReactNode;
  className?: string;
}

export function ArchiveMeta({ children, className = "" }: ArchiveMetaProps) {
  return <span className={`archive-meta ${className}`.trim()}>{children}</span>;
}

export function ArchiveIndex({ number, label }: { number: number | string; label?: ReactNode }) {
  const value = typeof number === "number" ? String(number).padStart(2, "0") : number;
  return (
    <span className="archive-index" aria-hidden="true">
      <span>{value}</span>
      {label ? <small>{label}</small> : null}
    </span>
  );
}

export function StripeMarker({ label = "" }: { label?: string }) {
  return <span className="stripe-marker" aria-label={label || undefined} />;
}

export function StaffFragment({ className = "" }: { className?: string }) {
  return (
    <span className={`staff-fragment ${className}`.trim()} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

export function BeatTicks({ count = 4 }: { count?: number }) {
  return (
    <span className="beat-ticks" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index}>{index + 1}</i>)}
    </span>
  );
}

export function MarginNote({ children }: { children: ReactNode }) {
  return <aside className="margin-note">{children}</aside>;
}

export function RecordStamp({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "pink" | "green" }) {
  return <span className={`record-stamp ${tone}`}>{children}</span>;
}
