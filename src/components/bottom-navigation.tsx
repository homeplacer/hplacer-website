"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GridIcon, HomeMark, MapIcon, MessageIcon } from "@/components/icons";

const navigation = [
  { href: "/", label: "Home", Icon: HomeMark },
  { href: "/homes", label: "Homes", Icon: GridIcon },
  { href: "/land-packages", label: "Packages", Icon: MapIcon },
  { href: "/contact", label: "Contact", Icon: MessageIcon },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const [prefetchHref, setPrefetchHref] = useState<string>();

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-stone-line/90 bg-stone-bg/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgb(28_36_54_/_0.09)] backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {navigation.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              // This dock is visible on every mobile page. Wait for visitor
              // intent before fetching its other routes in the background.
              // Next's normal Link click and navigation behavior stays intact.
              prefetch={prefetchHref === href ? null : false}
              onPointerEnter={() => setPrefetchHref(href)}
              onFocus={() => setPrefetchHref(href)}
              onTouchStart={() => setPrefetchHref(href)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${active ? "bg-brand-50 text-brand-800" : "text-stone-muted hover:bg-stone-sunken hover:text-brand-800"}`}
            >
              <Icon className="size-[19px]" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
