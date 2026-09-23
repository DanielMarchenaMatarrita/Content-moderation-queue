import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  List,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { navigationSections } from '../../shared/config/navigation';
import { IconButton } from '../../shared/components/IconButton';
import { Sheet } from '../../shared/components/Modal';
import { ActivityCenter } from './ActivityCenter';
import { CommandPalette } from './CommandPalette';
import { QuickActions } from './QuickActions';

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
      <a
        className="nav-link api-docs-link"
        href="/api/docs"
        target="_blank"
        rel="noreferrer"
      >
        <BookOpen size={18} aria-hidden="true" />
        API documentation
      </a>
    </>
  );
}

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

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
          <div className="brand-mark" aria-hidden="true">CMQ</div>
          <div>
            <strong>Content Moderation</strong>
            <span>Queue observatory</span>
          </div>
        </div>
        <Navigation />
        <p className="sidebar-note">Investigation II / Message Queue demonstration</p>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <IconButton label="Open navigation" onClick={() => setMobileNavOpen(true)}>
              <List size={20} aria-hidden="true" />
            </IconButton>
            <div>
              <strong>CMQ</strong>
              <span>System observatory</span>
            </div>
          </div>
          <button className="command-trigger" type="button" aria-label="Search commands" onClick={() => setCommandOpen(true)}>
            <MagnifyingGlass size={17} aria-hidden="true" />
            <span>Search commands</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <QuickActions />
            <ActivityCenter open={activityOpen} onOpenChange={setActivityOpen} />
          </div>
        </header>

        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="CMQ navigation"
        description="Content Moderation Queue system observatory"
        side="left"
      >
        <div className="mobile-navigation">
          <Navigation onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Sheet>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
