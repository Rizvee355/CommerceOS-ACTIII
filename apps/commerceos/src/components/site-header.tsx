import Link from "next/link";

import { moduleRegistry } from "../features/module-registry";

export type NavigationSurface = "overview" | "promiseguard";

const titleCase = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const stateOf = (id: "marginleak" | "rescuecart"): string =>
  moduleRegistry.find((module) => module.id === id)?.state ?? "unknown";

/**
 * Unified CommerceOS navigation.
 *
 * Only real, approved routes are links. MarginLeak and RescueCart render as
 * inert text carrying the state reported by the capability registry, so the
 * header can never imply that those modules are available.
 */
export function SiteHeader({ current }: { current: NavigationSurface }) {
  const marginLeakState = stateOf("marginleak");
  const rescueCartState = stateOf("rescuecart");

  return (
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
            <Link
              className="nav-item"
              href="/"
              aria-current={current === "overview" ? "page" : undefined}
            >
              Overview
            </Link>
          </li>
          <li>
            <Link
              className="nav-item"
              href="/promiseguard"
              aria-current={current === "promiseguard" ? "page" : undefined}
            >
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
  );
}
