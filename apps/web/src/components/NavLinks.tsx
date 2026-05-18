'use client';
import { usePathname } from 'next/navigation';

/**
 * Top-level navigation (CP-9.5).
 *
 * Static links to the five list pages + dashboard. Replaces the
 * sessionStorage-based dynamic nav from CP-8b, which deep-linked the user
 * into the "active" intake's RCA / Plan / Approve / Evidence pages. With
 * CP-9.3 + CP-9.4 the list pages exist, so users can always navigate to a
 * list view and pick the workflow they want — no per-tab session state.
 *
 * The active route is highlighted with a darker color so the user knows
 * where they are. Pathname matching is prefix-based for nested deep links
 * (e.g. /intake/abc-123/rca matches the RCA tab).
 *
 * Tests: SCR-001..SCR-012 Pw specs all assert the static link presence
 * via `[data-testid="nav-<name>"]` getByTestId selectors.
 */

interface NavItem {
  label: string;
  href: string;
  testid: string;
  /**
   * Prefix to match for "active" highlight. The first match wins, so order
   * the items from most-specific to least-specific in case of overlaps.
   */
  prefix: string;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Intakes',   href: '/intakes',       testid: 'nav-intakes',   prefix: '/intakes' },
  { label: 'RCA',       href: '/rca',           testid: 'nav-rca',       prefix: '/rca' },
  { label: 'Plans',     href: '/repair-plans',  testid: 'nav-plans',     prefix: '/repair-plans' },
  { label: 'Approvals', href: '/approvals',     testid: 'nav-approvals', prefix: '/approvals' },
  { label: 'Evidence',  href: '/evidence',      testid: 'nav-evidence',  prefix: '/evidence' },
  { label: 'Dashboard', href: '/dashboard',     testid: 'nav-dashboard', prefix: '/dashboard' },
];

export function NavLinks() {
  const pathname = usePathname() ?? '/';

  return (
    <nav data-testid="top-nav" className="flex items-center gap-1 text-sm">
      <a
        data-testid="nav-home"
        href="/"
        className={`mr-2 px-2 py-1 rounded ${
          pathname === '/'
            ? 'bg-slate-100 font-medium text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        New intake
      </a>
      <span className="mx-1 text-slate-300">·</span>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.prefix}/`);
        return (
          <a
            key={item.href}
            data-testid={item.testid}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`px-2 py-1 rounded ${
              active
                ? 'bg-slate-100 font-medium text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
