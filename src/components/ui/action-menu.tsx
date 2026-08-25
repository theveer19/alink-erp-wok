"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings } from "lucide-react";

export interface ActionMenuItem {
  key: string;
  label: string;
  /** Hidden items are not rendered at all (use for role-based visibility). */
  hidden?: boolean;
  /** Disabled items are rendered greyed out; `reason` shows as a tooltip. */
  disabled?: boolean;
  reason?: string;
  danger?: boolean;
  /** Draw a hairline above this item (grouping). */
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface Props {
  items: ActionMenuItem[];
  /** "gear" = big header gear + chevron, "row" = small gear inside a table row. */
  variant?: "gear" | "row";
  label?: string;
  className?: string;
}

const MENU_WIDTH = 256; // w-64

/**
 * The menu is portalled to <body>; otherwise the table's
 * `overflow-x-auto` wrapper clips it and nothing shows up.
 * Opens on hover, and also on click / Enter / Space for touch and keyboard.
 */
export function ActionMenu({ items, variant = "gear", label = "Actions", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; dropUp: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  const visible = items.filter((i) => !i.hidden);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    // small delay so the menu stays open while moving the cursor onto it
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? Math.min(visible.length * 38 + 12, 420);

    const spaceBelow = window.innerHeight - r.bottom;
    const dropUp = spaceBelow < menuH + 16 && r.top > menuH + 16;

    // align the menu's right edge with the trigger's right edge
    let left = r.right - MENU_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));

    setPos({ top: dropUp ? r.top - menuH - 4 : r.bottom + 4, left, dropUp });
  }, [visible.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => place();

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    // capture: true so scrolling inside the table is caught too
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, place]);

  useEffect(() => cancelClose, []);

  const menu =
    open && pos && visible.length > 0 ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH }}
        className="z-[1000] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl"
      >
        {visible.map((item) => (
          <div key={item.key}>
            {item.separatorBefore && <div className="my-1 h-px bg-slate-100" />}
            <button
              type="button"
              role="menuitem"
              title={item.disabled ? item.reason : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={[
                "block w-full px-4 py-2 text-left text-[15px] transition-colors",
                item.disabled
                  ? "cursor-not-allowed text-slate-300"
                  : item.danger
                    ? "text-red-600 hover:bg-red-50"
                    : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {item.label}
            </button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onClick={() => setOpen((v) => !v)}
        className={[
          className,
          variant === "gear"
            ? "inline-flex items-center gap-1 rounded-md px-2 py-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            : "inline-flex items-center rounded p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        ].join(" ")}
      >
        <Settings className={variant === "gear" ? "h-5 w-5" : "h-4 w-4"} />
        {variant === "gear" && <ChevronDown className="h-4 w-4" />}
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
