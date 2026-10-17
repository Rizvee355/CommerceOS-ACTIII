import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarginLeakWorkspace } from "../../features/marginleak/ui/marginleak-workspace";
import { moduleRegistry } from "../../features/module-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MarginLeak Synthetic Development Preview — CommerceOS",
  description:
    "Deterministic order-level contribution-margin variance and leakage reconciliation (synthetic development preview).",
};

const isMarginLeakPreviewAllowed = (): boolean =>
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const titleCase = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const stateOf = (id: "marginleak" | "rescuecart"): string =>
  moduleRegistry.find((module) => module.id === id)?.state ?? "unknown";

export default function MarginLeakPage() {
  if (!isMarginLeakPreviewAllowed()) {
    notFound();
  }

  const marginLeakState = stateOf("marginleak");
  const rescueCartState = stateOf("rescuecart");

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="CommerceOS home">
          <span className="wordmark-mark" aria-hidden="true">
            CO
          </span>
          <span>CommerceOS</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          <ul>
            <li>
              <Link className="nav-item" href="/">
                Overview
              </Link>
            </li>
            <li>
              <Link className="nav-item" href="/promiseguard">
                PromiseGuard
                <span className="nav-tag" data-tone="preview">
                  Synthetic preview
                </span>
              </Link>
            </li>
            <li>
              <span className="nav-item nav-item-inert">
                MarginLeak
                <span className="nav-tag">{titleCase(marginLeakState)}</span>
              </span>
            </li>
            <li>
              <span className="nav-item nav-item-inert">
                RescueCart
                <span className="nav-tag">{titleCase(rescueCartState)}</span>
              </span>
            </li>
          </ul>
        </nav>
      </header>
      <main id="main-content" className="pg-page ml-page">
        <section className="pg-hero ml-hero" aria-labelledby="ml-hero-title">
          <div className="pg-hero-badge-row">
            <span className="mission-tag">
              PLANNED · SYNTHETIC DEVELOPMENT PREVIEW
            </span>
            <span className="pg-capability-tag">
              Module: MarginLeak (G4C Local Preview · Capability: Planned)
            </span>
          </div>
          <h1 id="ml-hero-title" className="pg-hero-title">
            Contribution-Margin Variance &amp; Leakage Intelligence
          </h1>
          <p className="pg-hero-summary">
            Reconcile expected versus observed order economics across all eight
            canonical financial categories in exact minor currency units.
            Distinguish confirmed final leakage from favorable cost offsets,
            provisional pre-settlement variance, and incomplete financial
            evidence.
          </p>
        </section>

        <MarginLeakWorkspace />
      </main>
    </>
  );
}
