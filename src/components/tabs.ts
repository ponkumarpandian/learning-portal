export interface TabDef {
  to: string;
  emoji: string;
  label: string;
}

/** The four kid tabs (§15.1). Routes are app structure, not content. */
export const KID_TABS: readonly TabDef[] = [
  { to: '/', emoji: '🗺️', label: 'Today' },
  { to: '/week', emoji: '📅', label: 'Week' },
  { to: '/progress', emoji: '🏆', label: 'Rewards' },
  { to: '/me', emoji: '😊', label: 'Me' },
];
