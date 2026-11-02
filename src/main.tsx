import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useContent } from './state/content';
import { initSettings } from './state/settingsStore';

// Apply the saved look before the first paint, then wait (briefly) for Dexie so the world never flickers.
const ready = Promise.race([
  Promise.all([initSettings(), useContent.getState().refresh()]),
  new Promise((resolve) => setTimeout(resolve, 600)),
]);

void ready.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
