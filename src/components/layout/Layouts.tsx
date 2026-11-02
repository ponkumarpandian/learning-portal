import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSettings } from '@/state/settingsStore';
import { TabBar } from '../TabBar';
import { WorldDecor } from '../WorldDecor';

function useScrollTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
}

function Decor() {
  const world = useSettings((s) => s.settings.world);
  const theme = useSettings((s) => s.theme);
  return <WorldDecor world={world} theme={theme} />;
}

/** Kid screens with the bottom tab bar (§15.1). */
export function KidLayout() {
  useScrollTopOnNavigate();
  return (
    <>
      <Decor />
      <div className="app">
        <main id="main">
          <Outlet />
        </main>
      </div>
      <TabBar />
    </>
  );
}

/** Focus mode (lesson, test, results, revise): no tab bar, a big ✕ at the top (§15.2). */
export function FocusLayout() {
  useScrollTopOnNavigate();
  return (
    <>
      <Decor />
      <div className="app is-focus">
        <main id="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}

/** Parent area: a calmer, plain version of the same tokens (§15.1). */
export function ParentLayout() {
  useScrollTopOnNavigate();
  return (
    <div className="app is-parent">
      <main id="main">
        <Outlet />
      </main>
    </div>
  );
}
