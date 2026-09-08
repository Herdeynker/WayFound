import React from "react";

export function DesktopRouteSignature() {
  return (
    <svg
      aria-label="Your next step is a bigger story."
      className="desktop-route-signature"
      role="img"
      viewBox="0 0 530 120"
    >
      <path className="route-solid" d="M18 79C55 43 75 50 103 35" />
      <circle className="route-node" cx="18" cy="79" r="7" />
      <text className="route-caption route-caption-top" x="128" y="34">
        Your next step
      </text>
      <text className="route-caption route-caption-top" x="147" y="57">
        is a bigger story.
      </text>
      <path className="route-dotted" d="M296 42C348 3 388 28 420 42c38 17 65 13 88-10" />
      <path
        className="route-pin"
        d="M503 16c-10 0-18 8-18 18 0 12 18 31 18 31s18-19 18-31c0-10-8-18-18-18Z"
      />
      <circle className="route-pin-hole" cx="503" cy="34" r="5" />
    </svg>
  );
}

export function SidebarRouteSignature() {
  return (
    <svg
      aria-label="A brighter tomorrow. A wider you."
      className="sidebar-route-signature"
      role="img"
      viewBox="0 0 230 190"
    >
      <path className="route-dotted" d="M24 71C58 31 109 34 145 54c27 14 48 10 68-7" />
      <path className="route-pin" d="M24 77c-8 0-14 6-14 14 0 9 14 24 14 24s14-15 14-24c0-8-6-14-14-14Z" />
      <circle className="route-pin-hole" cx="24" cy="90" r="4" />
      <text className="route-caption route-caption-side" x="75" y="78">
        A brighter
      </text>
      <text className="route-caption route-caption-side" x="82" y="103">
        tomorrow.
      </text>
      <text className="route-caption route-caption-side" x="82" y="128">
        A wider you.
      </text>
    </svg>
  );
}

export function MobileProgressRoute() {
  return (
    <svg
      aria-label="Opportunity Path progress: three steps complete and one step remaining"
      className="mobile-progress-route"
      role="img"
      viewBox="0 0 350 180"
    >
      <path
        className="mobile-route-base"
        d="M28 103C75 47 127 54 155 93c24 35 62 42 94 22 23-14 39-35 70-57"
      />
      <path className="mobile-route-active" d="M28 103C75 47 127 54 155 93c24 35 62 42 94 22" />
      {[
        { x: 28, y: 103 },
        { x: 108, y: 70 },
        { x: 188, y: 112 },
      ].map((point) => (
        <g key={`${point.x}-${point.y}`}>
          <circle className="mobile-route-checkpoint" cx={point.x} cy={point.y} r="15" />
          <path className="mobile-route-check" d={`m${point.x - 6} ${point.y} 4 4 8-9`} />
        </g>
      ))}
      <circle className="mobile-route-current" cx="268" cy="112" r="15" />
      <path
        className="mobile-route-end"
        d="M318 35c-8 0-14 6-14 14 0 9 14 24 14 24s14-15 14-24c0-8-6-14-14-14Z"
      />
      <circle className="mobile-route-end-hole" cx="318" cy="49" r="4" />
      <g className="route-bubble">
        <rect height="28" rx="14" width="101" x="210" y="137" />
        <text x="228" y="156">
          Almost there!
        </text>
      </g>
    </svg>
  );
}
