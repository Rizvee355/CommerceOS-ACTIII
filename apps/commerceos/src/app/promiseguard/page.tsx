import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { PromiseGuardWorkspace } from "../../features/promiseguard/ui/promiseguard-workspace";

export const metadata: Metadata = {
  title: "PromiseGuard Preview — CommerceOS",
  description:
    "Deterministic dispatch readiness evaluation and operational intelligence preview.",
};

export default function PromiseGuardPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader current="promiseguard" />
      <main id="main-content" className="pg-page">
        <section className="pg-hero" aria-labelledby="pg-hero-title">
          <div className="pg-hero-badge-row">
            <span className="mission-tag">Mission 003 · Synthetic Preview</span>
            <span className="pg-capability-tag">
              Module: PromiseGuard (G3C Preview)
            </span>
          </div>
          <h1 id="pg-hero-title" className="pg-hero-title">
            Dispatch Readiness Intelligence
          </h1>
          <p className="pg-hero-summary">
            Evaluate fulfillment evidence against deterministic governance
            rules. Identify operational risks, verify evidence freshness, and
            review accelerated mitigations before dispatch deadlines pass.
          </p>
        </section>

        <PromiseGuardWorkspace />
      </main>
    </>
  );
}
