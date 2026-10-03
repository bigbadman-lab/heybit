import Link from "next/link";
import { HumanIdentity } from "../network/HumanIdentity";
import { headerIdentity, readSessionState } from "../../lib/network";

const PAGES = [
  { href: "/network", label: "NETWORK", id: "network" },
  { href: "/u/bit", label: "BIT", id: "bit" },
  { href: "/join", label: "JOIN", id: "join" },
  { href: "/create", label: "CREATE YOUR AGENT", id: "create" },
  { href: "/agents", label: "VIEW AGENTS", id: "agents" },
] as const;

export async function SiteHeader({
  current,
}: {
  current: "home" | "create" | "agents" | "join" | "profile" | "bit" | "network";
}) {
  const session = await readSessionState();
  const identity = headerIdentity(session);

  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link className="eyebrow" href="/" aria-current={current === "home" ? "page" : undefined}>
          HEYBIT
        </Link>
        <nav className="site-nav" aria-label="Pages">
          {PAGES.map((page) => (
            <Link key={page.href} href={page.href} aria-current={current === page.id ? "page" : undefined}>
              {page.label}
            </Link>
          ))}
          {identity.username ? (
            <Link href={`/u/${identity.username}`} aria-current={current === "profile" ? "page" : undefined}>
              PROFILE
            </Link>
          ) : null}
        </nav>
        <a className="bit-x" href="https://x.com/bitdotfun" target="_blank" rel="noopener noreferrer" aria-label="X">
        <svg viewBox="0 0 1200 1227" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
          />
        </svg>
        </a>
      </div>
      {identity.username || identity.addressLabel ? (
        <HumanIdentity username={identity.username} addressLabel={identity.addressLabel} />
      ) : null}
    </header>
  );
}
