"use client";

import Link from "next/link";
import { useState } from "react";
import { navLinks, site } from "@/lib/site";
import { MenuIcon, CloseIcon, PhoneIcon } from "@/components/icons";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-line/80 bg-stone-bg/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Home Placer LLC" className="h-11 w-auto" />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-lg font-semibold text-brand-800">Home Placer</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-muted">
              Horry County, SC
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-stone-ink/80 transition hover:bg-stone-sunken hover:text-brand-800"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${site.phoneDial}`}
            className="hidden items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 sm:inline-flex"
          >
            <PhoneIcon className="size-4" />
            {site.phoneDisplay}
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-md text-stone-ink hover:bg-stone-sunken lg:hidden"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-stone-line bg-stone-bg lg:hidden">
          <div className="container-x flex flex-col py-2">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-stone-ink hover:bg-stone-sunken"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={`tel:${site.phoneDial}`}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-base font-semibold text-white"
            >
              <PhoneIcon className="size-4" />
              {site.phoneDisplay}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
