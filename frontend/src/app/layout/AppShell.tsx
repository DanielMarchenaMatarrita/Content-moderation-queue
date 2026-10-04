import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  List,
} from '@phosphor-icons/react';
import { navigationSections } from '../../shared/config/navigation';
import { IconButton } from '../../shared/components/IconButton';
import { Sheet } from '../../shared/components/Modal';

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigationSections.map((section) => (
          <div key={section.label} className="nav-section">
            <span className="nav-section-label">{section.label}</span>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link-active' : ''}`
                  }
                  onClick={onNavigate}
                >
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">PG</div>
          <div>
            <strong>PayGrid</strong>
            <span>Payment processing</span>
          </div>
        </div>
        <Navigation />
        <p className="sidebar-note">Asynchronous payment operations</p>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <IconButton label="Open navigation" onClick={() => setMobileNavOpen(true)}>
              <List size={20} aria-hidden="true" />
            </IconButton>
            <div>
              <strong>PayGrid</strong>
              <span>Payment processing</span>
            </div>
          </div>
          <span className="topbar-product">Order processing workspace</span>
        </header>

        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="PayGrid navigation"
        description="Payment processing workspace"
        side="left"
      >
        <div className="mobile-navigation">
          <Navigation onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Sheet>
    </div>
  );
}
