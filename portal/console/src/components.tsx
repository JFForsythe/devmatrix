// SPDX-License-Identifier: GPL-3.0-or-later
import type { ComponentChildren } from "preact";
import type { StatusMessage } from "./types";

export function ViewHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: ComponentChildren }) {
  return (
    <header class="view-header">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

export function Card({
  title,
  aside,
  className = "",
  children,
}: {
  title?: string;
  aside?: ComponentChildren;
  className?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`card ${className}`.trim()}>
      {(title || aside) && (
        <div class="card-head">
          {title && <h2>{title}</h2>}
          {aside && <div class="card-aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function GateChip({ gate }: { gate: "M0" | "M1" | "M4" }) {
  return <span class="chip gate">ARRIVES AT GATE {gate}</span>;
}

export function Status({ message }: { message: StatusMessage | null }) {
  if (!message) return null;
  return (
    <p class={`status ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
      {message.text}
    </p>
  );
}

export function LoadingCard() {
  return (
    <section class="card loading-card" aria-live="polite">
      <span class="spinner" aria-hidden="true" /> Reading the device…
    </section>
  );
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through for HTTP device origins without Clipboard API permission.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
