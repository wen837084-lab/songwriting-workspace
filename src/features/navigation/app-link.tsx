"use client";

import NextLink from "next/link";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

export const DESKTOP_NAVIGATION_EVENT = "songwriting-workspace:navigate";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function navigateDesktop(href: string, replace = false): void {
  const destination = new URL(href, window.location.href);
  const current = new URL(window.location.href);
  if (destination.origin !== current.origin) {
    window.location.assign(destination.href);
    return;
  }

  if (destination.pathname === current.pathname && destination.search === current.search) {
    if (destination.hash !== current.hash) window.location.hash = destination.hash;
    return;
  }

  window.history[replace ? "replaceState" : "pushState"]({}, "", destination.href);
  window.dispatchEvent(new Event(DESKTOP_NAVIGATION_EVENT));
}

export function AppLink({ href, onClick, target, download, ...props }: AppLinkProps) {
  if (process.env.NEXT_PUBLIC_DESKTOP_STATIC !== "true") {
    return <NextLink href={href} onClick={onClick} target={target} download={download} {...props} />;
  }

  return (
    <a
      href={href}
      target={target}
      download={download}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented
          || !isPlainPrimaryClick(event)
          || target === "_blank"
          || download !== undefined
        ) return;

        const destination = new URL(href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        event.preventDefault();
        navigateDesktop(destination.href);
      }}
      {...props}
    />
  );
}
