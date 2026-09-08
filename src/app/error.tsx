"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="foundation-page">
      <section className="foundation-card" role="alert">
        <p className="eyebrow">WAYFOUND</p>
        <h1>We could not load this workspace.</h1>
        <p>Please try again. If the problem continues, contact support with the time of the error.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
