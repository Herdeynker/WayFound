import React from "react";

export function FoundationStatus() {
  return (
    <section aria-labelledby="foundation-title" className="foundation-card">
      <p className="eyebrow">WAYFOUND</p>
      <h1 id="foundation-title">Application foundation ready</h1>
      <p>This authenticated application workspace is prepared for the next implementation phase.</p>
      <a href="/health">View service health</a>
    </section>
  );
}
