"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-shell">
      <section className="error-panel" role="alert">
        <p className="eyebrow">Application error</p>
        <h1>The foundation view could not load.</h1>
        <p>
          No product decision was made. Retry the request or check service
          health.
        </p>
        <div className="error-actions">
          <button type="button" onClick={reset}>
            Retry
          </button>
          <a href="/api/v1/health">Check health</a>
        </div>
      </section>
    </main>
  );
}
