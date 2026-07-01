"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A floor-plan thumbnail that opens a fullscreen pan/zoom viewer on click.
export function ZoomableFloorPlan({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Zoom in on ${alt}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-card border border-stone-line bg-white p-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="mx-auto w-full object-contain" />
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-stone-ink/70 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          <SearchPlusIcon className="size-3.5" /> Click to zoom
        </span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <ZoomModal src={src} alt={alt} onClose={close} />,
        document.body,
      )}
    </>
  );
}

function ZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);
  const dragLast = useRef<{ x: number; y: number } | null>(null);

  const clampPos = useCallback((p: { x: number; y: number }, s: number) => {
    const img = imgRef.current;
    if (!img) return p;
    const maxX = (img.clientWidth * (s - 1)) / 2;
    const maxY = (img.clientHeight * (s - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  }, []);

  // Apply a zoom update functionally so rapid wheel/pinch events don't read stale scale.
  const applyZoom = useCallback(
    (updater: (s: number) => number) => {
      setScale((s) => {
        const ns = Math.min(5, Math.max(1, updater(s)));
        setPos((p) => (ns === 1 ? { x: 0, y: 0 } : clampPos(p, ns)));
        return ns;
      });
    },
    [clampPos],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") applyZoom((s) => s + 0.5);
      else if (e.key === "-" || e.key === "_") applyZoom((s) => s - 0.5);
      else if (e.key === "0") applyZoom(() => 1);
      else if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f || !f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, applyZoom]);

  function onWheel(e: React.WheelEvent) {
    applyZoom((s) => s - (e.deltaY * 0.0016) * s);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragLast.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      dragLast.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && pinchDist.current != null) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / pinchDist.current;
      pinchDist.current = dist;
      applyZoom((s) => s * ratio);
    } else if (pts.length === 1 && dragLast.current && scaleRef.current > 1) {
      const dx = e.clientX - dragLast.current.x;
      const dy = e.clientY - dragLast.current.y;
      dragLast.current = { x: e.clientX, y: e.clientY };
      setPos((p) => clampPos({ x: p.x + dx, y: p.y + dy }, scaleRef.current));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
    const rest = [...pointers.current.values()];
    dragLast.current = rest.length === 1 ? { ...rest[0] } : null;
  }

  function toggleZoom() {
    applyZoom((s) => (s > 1 ? 1 : 2.5));
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — zoom view`}
      className="fixed inset-0 z-[110] flex flex-col bg-stone-ink/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 text-white sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium tabular-nums text-white/80">
          {Math.round(scale * 100)}%
        </span>
        <div className="flex items-center gap-1.5">
          <ToolBtn label="Zoom out" onClick={() => applyZoom((s) => s - 0.5)}>
            <MinusIcon className="size-5" />
          </ToolBtn>
          <ToolBtn label="Reset zoom" onClick={() => applyZoom(() => 1)}>
            <ResetIcon className="size-5" />
          </ToolBtn>
          <ToolBtn label="Zoom in" onClick={() => applyZoom((s) => s + 0.5)}>
            <PlusIcon className="size-5" />
          </ToolBtn>
          <ToolBtn label="Close" onClick={onClose}>
            <CloseIcon className="size-5" />
          </ToolBtn>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative flex flex-1 touch-none select-none items-center justify-center overflow-hidden px-4 pb-4"
        style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onDoubleClick={toggleZoom}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: "center" }}
        />
      </div>

      <p className="pointer-events-none pb-4 text-center text-xs text-white/60">
        Scroll or pinch to zoom · drag to pan · double-click to toggle
      </p>
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
    >
      {children}
    </button>
  );
}

function SearchPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><path d="M12 5v14M5 12h14" /></svg>;
}
function MinusIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><path d="M5 12h14" /></svg>;
}
function ResetIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
}
function CloseIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
