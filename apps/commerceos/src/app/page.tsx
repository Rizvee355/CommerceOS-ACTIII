import Link from "next/link";
import { SiteHeader } from "../components/site-header";
import { moduleRegistry } from "../features/module-registry";

const readiness = [
  { label: "Architecture", value: "Approved", tone: "ready" },
  { label: "Shared contracts", value: "Foundation v1", tone: "ready" },
  { label: "AMD inference", value: "Verified · gated", tone: "ready" },
] as const;

const titleCase = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export default function HomePage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader current="overview" />
      <main id="main-content" className="overview">
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">AMD ACT III · Technical foundation</p>
            <h1>Commerce intelligence, one system.</h1>
            <p className="hero-summary">
              A unified, contract-first foundation for operational commerce
              decisions. A functional synthetic preview is available for
              PromiseGuard. AMD Token Factory inference is authenticated for a
              controlled synthetic workflow; public activation remains gated.
            </p>
          </div>

          <ol className="readiness-rail" aria-label="Foundation readiness">
            {readiness.map((item) => (
              <li key={item.label} data-tone={item.tone}>
                <span className="rail-dot" aria-hidden="true" />
                <span className="rail-label">{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="module-section" aria-labelledby="modules-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Unified modules</p>
              <h2 id="modules-heading">Foundation state</h2>
            </div>
            <a className="text-link" href="/api/v1/capabilities">
              Inspect capability API <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="module-grid">
            {moduleRegistry.map((module) => (
              <article
                className="module-card"
                data-state={module.state}
                data-testid={`capability-${module.id}`}
                key={module.id}
              >
                <div className="module-card-header">
                  <span className="module-code">{module.id}</span>
                  <span className="status-pill">{titleCase(module.state)}</span>
                </div>
                <h3>{module.label}</h3>
                <p>{module.description}</p>
                <footer>
                  {module.routes.length === 0
                    ? "No product routes exposed"
                    : `${module.routes.length} route(s)`}
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="state-grid" aria-label="Foundation limitations">
          <article className="state-panel state-panel-warning">
            <span className="state-icon" aria-hidden="true">
              ⌁
            </span>
            <div>
              <h2>AMD integration verified</h2>
              <p>
                Authenticated Token Factory inference and the server-side
                PromiseGuard advisory path are verified with synthetic data.
                Public Token Factory access remains disabled until a separate
                access-control and deployment approval.
              </p>
            </div>
          </article>
          <article className="state-panel">
            <span className="state-icon" aria-hidden="true">
              —
            </span>
            <div>
              <h2>Synthetic preview available</h2>
              <p>
                PromiseGuard features a functional backend evaluator and
                synthetic preview route. Public AMD activation, merchant
                integrations, and persistent workflows remain pending.
              </p>
              <p className="state-panel-action">
                <Link className="text-link" href="/promiseguard">
                  Open synthetic workspace <span aria-hidden="true">→</span>
                </Link>
              </p>
            </div>
          </article>
        </section>

        <footer className="site-footer">
          <span>Foundation contract 1.0</span>
          <span>Public demo · live inference off</span>
        </footer>
      </main>
    </>
  );
}
