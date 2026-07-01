import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PhoneIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ArrowIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const BedIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2 9V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v4M2 11h20v8M2 19v2M22 19v2M2 13h7v-2a1 1 0 0 1 1-1h2" />
  </svg>
);

export const BathIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 12V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2M2 12h20M5 12v3a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3M7 22l1-2M17 22l-1-2" />
  </svg>
);

export const RulerIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4" />
  </svg>
);

export const PinIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const HomeMark = (p: IconProps) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    <path d="M9.5 20v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5" />
  </svg>
);

// Brand glyphs — filled (fill="currentColor"), so they ignore the stroke `base`.
const brand = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "currentColor",
} as const;

export const InstagramIcon = (p: IconProps) => (
  <svg {...brand} {...p}>
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 2.76a7.08 7.08 0 1 0 0 14.16 7.08 7.08 0 0 0 0-14.16Zm0 11.68a4.6 4.6 0 1 1 0-9.2 4.6 4.6 0 0 1 0 9.2Zm7.35-11.96a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z" />
  </svg>
);

export const TiktokIcon = (p: IconProps) => (
  <svg {...brand} {...p}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.04.87.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.66 20.1a6.34 6.34 0 0 0 10.86-4.43V8.65a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.7-.08Z" />
  </svg>
);

export const FacebookIcon = (p: IconProps) => (
  <svg {...brand} {...p}>
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
  </svg>
);
