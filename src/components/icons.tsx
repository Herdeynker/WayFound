import React, { type SVGProps } from "react";

export type IconName =
  | "arrow-right"
  | "bell"
  | "bookmark"
  | "briefcase"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "file"
  | "home"
  | "map-pin"
  | "message"
  | "more"
  | "profile"
  | "readiness"
  | "search"
  | "spark"
  | "x";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

const paths: Record<IconName, React.ReactNode> = {
  "arrow-right": <path d="M5 12h13m-6-6 6 6-6 6" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  bookmark: <path d="M6 4.75A2.75 2.75 0 0 1 8.75 2h6.5A2.75 2.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" />,
  briefcase: (
    <path d="M4 7.5h16a1 1 0 0 1 1 1v9.75a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a1 1 0 0 1 1-1ZM8 7.5V5.75A1.75 1.75 0 0 1 9.75 4h4.5A1.75 1.75 0 0 1 16 5.75V7.5m-13 3.25h18m-10 0v2.5h4v-2.5" />
  ),
  calendar: (
    <path d="M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2Zm-2 5h18M8 2v4m8-4v4M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01" />
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  file: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6" />,
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
  "map-pin": (
    <path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  ),
  message: (
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Zm3 6h.01M12 11h.01M16 11h.01" />
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  readiness: <path d="M4 20V10m5 10V6m5 14v-8m5 8V3M2 20h20" />,
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.75" />
      <path d="m16 16 5 5" />
    </>
  ),
  spark: (
    <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Zm6 12 .55 2.45L21 18l-2.45.55L18 21l-.55-2.45L15 18l2.45-.55L18 15Z" />
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({ name, size = 24, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
