import React from "react";
import type { OpportunityFixture } from "@/features/dashboard/dashboard-fixtures";

export function DestinationArtwork({ artwork, title }: Pick<OpportunityFixture, "artwork" | "title">) {
  return (
    <div
      aria-label={`${title} destination illustration`}
      className={`destination-art destination-art-${artwork}`}
      role="img"
    >
      {artwork === "china" ? (
        <svg viewBox="0 0 300 100">
          <path d="M42 75h216L224 57H76L42 75Z" />
          <path d="M65 57 150 31l85 26" />
          <path d="m82 57 68-18 68 18M105 54v21m30-27v27m30-27v27m30-21v21" />
          <path d="M150 31V18m-10 12 10-10 10 10" />
        </svg>
      ) : null}
      {artwork === "germany" ? (
        <svg viewBox="0 0 300 100">
          <path d="M40 80h220M55 80V50h190v30M65 50V38h170v12M77 38V24h146v14M93 24h114" />
          <path d="M78 50v30m30-30v30m30-30v30m30-30v30m30-30v30" />
          <path d="M125 24v-9h50v9" />
        </svg>
      ) : null}
      {artwork === "canada" ? (
        <svg viewBox="0 0 300 100">
          <path d="M35 82h230M65 82V54l13-9 12 9v28m31 0V35l15-12 15 12v47m42 0V47l12-8 12 8v35" />
          <path d="M143 23V8m-12 9 12-6 12 6m-20 13 8-13 8 13" />
          <circle cx="143" cy="9" r="3" />
        </svg>
      ) : null}
    </div>
  );
}
