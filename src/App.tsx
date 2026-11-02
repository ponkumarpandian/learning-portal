import { MotionConfig } from 'framer-motion';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './routes';

/** App root: router + motion settings (all Framer animations honour prefers-reduced-motion). */
export function App() {
  const [router] = useState(() => createBrowserRouter(buildRoutes()));
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
