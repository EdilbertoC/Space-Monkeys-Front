import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./ui";

interface SelectOptionProps {
  value?: string | number;
  children: ReactNode;
  disabled?: boolean;
}

/** Shared single-value filter; selections in different controls remain independent. */
export default function SelectControl({
  label,
  value,
  onChange,
  children,
  icon = "globe",
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement<SelectOptionProps>)
    .map((child) => {
      const { value, children, disabled } = child.props;
      return { value: String(value ?? children), label: children, disabled };
    });
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 240, maxHeight: 300 });
  const selected = options.findIndex((o) => o.value === String(value));
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  const show = () => {
    const r = trigger.current!.getBoundingClientRect(),
      height = Math.min(300, window.innerHeight - 32);
    setPos({
      left: Math.max(12, Math.min(r.left, window.innerWidth - Math.max(240, r.width) - 12)),
      top:
        r.bottom + height + 8 > window.innerHeight
          ? Math.max(12, r.top - height - 6)
          : r.bottom + 6,
      width: Math.min(window.innerWidth - 24, Math.max(240, r.width)),
      maxHeight: height,
    });
    setActive(Math.max(0, selected));
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node))
        close();
    };
    const reposition = () => close();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    const other = () => close();
    window.addEventListener("orbit-filter-open", other);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orbit-filter-open", other);
    };
  }, [open]);
  useEffect(() => {
    menu.current
      ?.querySelector(`[data-option-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const choose = (index: number) => {
    const item = options[index];
    if (item && !item.disabled) {
      onChange(item.value);
      close(true);
    }
  };
  return (
    <div className="orbit-select">
      <button
        ref={trigger}
        disabled={disabled}
        className="orbit-filter-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        onClick={() => {
          if (open) close();
          else {
            window.dispatchEvent(new Event("orbit-filter-open"));
            show();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            window.dispatchEvent(new Event("orbit-filter-open"));
            show();
          }
        }}
      >
        <Icon name={icon} size={16} />
        <span>{options[selected]?.label ?? String(value)}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            ref={menu}
            className="orbit-select-menu"
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={`${id}-${active}`}
            style={{ position: "fixed", ...pos }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close(true);
              } else if (e.key === "Tab") {
                close();
                trigger.current?.focus();
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose(active);
              } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                setActive((n) =>
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? options.length - 1
                      : Math.max(
                          0,
                          Math.min(options.length - 1, n + (e.key === "ArrowDown" ? 1 : -1)),
                        ),
                );
              } else if (e.key.length === 1) {
                const next = options.findIndex(
                  (o, i) =>
                    i > active && String(o.label).toLowerCase().startsWith(e.key.toLowerCase()),
                );
                if (next >= 0) setActive(next);
              }
            }}
          >
            {options.map((item, i) => (
              <div
                id={`${id}-${i}`}
                data-option-index={i}
                key={item.value}
                role="option"
                aria-selected={i === selected}
                aria-disabled={item.disabled}
                className={i === active ? "is-active" : ""}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{item.label}</span>
                {i === selected && <Icon name="check" size={14} />}
              </div>
            ))}
          </div>,
          document.fullscreenElement ?? document.body,
        )}
    </div>
  );
}
