import { motion } from 'framer-motion';
import { NavLink } from 'react-router';
import { KID_TABS, type TabDef } from './tabs';

/**
 * Fixed bottom tab bar: big emoji + a word, items ≥ 76px (spec minimum 68). The active tab gets a
 * tinted pill (slides between tabs) and a slightly bigger emoji; NavLink sets aria-current="page".
 */
export function TabBar({ tabs = KID_TABS }: { tabs?: readonly TabDef[] }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <ul>
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink to={t.to} end={t.to === '/'} className="tab">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      className="t-pill"
                      layoutId="tab-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="t-emo" aria-hidden="true">
                    {t.emoji}
                  </span>
                  <span className="t-word">{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
