import React from "react";

type WayfoundLogoProps = {
  variant?: "light" | "dark";
  markOnly?: boolean;
  className?: string;
};

export function WayfoundLogo({ variant = "light", markOnly = false, className }: WayfoundLogoProps) {
  const routeColor = variant === "light" ? "#FFFFFF" : "#102A43";
  const wordmarkColor = variant === "light" ? "#FFFFFF" : "#102A43";

  return (
    <svg
      aria-label={markOnly ? "WAYFOUND logo mark" : "WAYFOUND"}
      className={className}
      height={markOnly ? 52 : 42}
      role="img"
      viewBox={markOnly ? "0 0 64 64" : "0 0 238 64"}
      width={markOnly ? 52 : 194}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 43c9-11 15-3 22 1 7 4 12 2 17-5" stroke={routeColor} strokeWidth="4" />
        <circle cx="13" cy="43" fill="#F5A623" r="4" />
        <circle cx="52" cy="39" fill="#F5A623" r="4" />
        <path
          d="M42 8c-9.2 0-16.5 7.2-16.5 16.1C25.5 34 42 52 42 52s16.5-18 16.5-27.9C58.5 15.2 51.2 8 42 8Z"
          fill="#0EA5A4"
          stroke="#0EA5A4"
          strokeWidth="2"
        />
        <circle cx="42" cy="24" fill={variant === "light" ? "#071A2B" : "#FFFFFF"} r="5.3" />
      </g>
      {!markOnly && (
        <text
          fill={wordmarkColor}
          fontFamily="var(--font-sora), Arial, sans-serif"
          fontSize="25"
          fontWeight="800"
          letterSpacing="1.4"
          x="73"
          y="39"
        >
          WAYFOUND
        </text>
      )}
    </svg>
  );
}
