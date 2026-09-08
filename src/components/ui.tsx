"use client";

import {
  cloneElement,
  default as React,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import Image from "next/image";
import { Icon, type IconName } from "./icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "teal" | "quiet";

export function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      className={`ui-button ui-button-${variant} ${loading ? "is-loading" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  size = 22,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName; size?: number }) {
  return (
    <button aria-label={label} className={`icon-button ${className}`} type="button" {...props}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function SearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`search-input ${className}`}>
      <Icon name="search" size={22} />
      <input aria-label="Search opportunities, skills or countries" type="search" {...props} />
    </label>
  );
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`ui-input ui-select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className="choice-control" htmlFor={inputId}>
      <input id={inputId} type="checkbox" {...props} />
      <span className="choice-mark" aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="radio-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="choice-control" key={option.value}>
          <input
            checked={value === option.value}
            name={name}
            onChange={() => onChange?.(option.value)}
            type="radio"
            value={option.value}
          />
          <span className="radio-mark" aria-hidden="true" />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${className}`} {...props} />;
}

export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const labelledChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string; "aria-describedby"?: string }>, {
        id,
        "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
      })
    : children;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {labelledChild}
      {hint && !error ? <small id={`${id}-hint`}>{hint}</small> : null}
      {error ? (
        <small className="field-error" id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}

export function Chip({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "blue" | "amber" }) {
  return <span className={`ui-chip ui-chip-${tone}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
  as: Element = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Element className={`ui-card ${className}`}>{children}</Element>;
}

export function ProgressIndicator({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-indicator"
      aria-label={`${label}: ${value}%`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function Step({
  label,
  complete = false,
  current = false,
}: {
  label: string;
  complete?: boolean;
  current?: boolean;
}) {
  return (
    <div className={`step ${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}>
      <span className="step-dot" aria-hidden="true">
        {complete ? <Icon name="check" size={14} /> : null}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function Avatar({
  label,
  imageSrc,
  size = "medium",
}: {
  label: string;
  imageSrc?: string;
  size?: "small" | "medium" | "large";
}) {
  return imageSrc ? (
    <Image
      alt={`${label} profile`}
      className={`avatar avatar-${size}`}
      height={68}
      src={imageSrc}
      width={68}
    />
  ) : (
    <span aria-label={`${label} avatar`} className={`avatar avatar-${size} avatar-initials`} role="img">
      {label.slice(0, 1)}
    </span>
  );
}

export function Badge({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: "teal" | "amber" | "slate";
}) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tooltip-wrap">
      <span aria-label={label} tabIndex={0}>
        {children}
      </span>
      <span className="tooltip-content" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <IconButton icon="x" label="Close dialog" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        aria-labelledby="drawer-title"
        aria-modal="true"
        className="drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-header">
          <h2 id="drawer-title">{title}</h2>
          <IconButton icon="x" label="Close menu" onClick={onClose} />
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: "success" | "error" | "info";
  onClose?: () => void;
}) {
  return (
    <div aria-live="polite" className={`toast toast-${tone}`} role="status">
      <span>{message}</span>
      {onClose ? <IconButton icon="x" label="Dismiss notification" onClick={onClose} /> : null}
    </div>
  );
}

export function DropdownMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dropdown">
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        variant="quiet"
      >
        {label}
        <Icon name="chevron-down" size={16} />
      </Button>
      {open ? (
        <div className="dropdown-panel" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-card">
      <span className="state-icon">
        <Icon name="spark" size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="state-card state-error" role="alert">
      <span className="state-icon">
        <Icon name="x" size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function OfflineState() {
  return (
    <div className="offline-state" role="status">
      <Icon name="more" size={18} /> You are offline. Your saved work will sync when you reconnect.
    </div>
  );
}

function useEscape(callback: () => void, active: boolean) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") callbackRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);
}
