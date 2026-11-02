import type { RouteObject } from 'react-router';
import { FocusLayout, KidLayout, ParentLayout } from '@/components/layout/Layouts';
import { defaultAllowFakeClock } from '@/engine/clock';
import { ResultsPlaceholder, RevisePlaceholder, TestPlaceholder } from '@/features/focus/FocusPlaceholders';
import { KitScreen } from '@/features/kit/KitScreen';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { MeScreen } from '@/features/me/MeScreen';
import { NotFound } from '@/features/NotFound';
import { ParentPlaceholder } from '@/features/parent/ParentPlaceholder';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WeekScreen } from '@/features/week/WeekScreen';

/**
 * Route table (§15.1). Kid tabs show the tab bar; focus routes (lesson, test, results, revise) hide it.
 * /kit is a dev/QA component gallery, present only when fake time is allowed (dev builds).
 */
export function buildRoutes(allowDev: boolean = defaultAllowFakeClock()): RouteObject[] {
  return [
    {
      element: <KidLayout />,
      children: [
        { index: true, element: <TodayScreen /> },
        { path: 'week', element: <WeekScreen /> },
        { path: 'progress', element: <ProgressScreen /> },
        { path: 'me', element: <MeScreen /> },
        ...(allowDev ? [{ path: 'kit', element: <KitScreen /> }] : []),
        { path: '*', element: <NotFound /> },
      ],
    },
    {
      element: <FocusLayout />,
      children: [
        { path: 'lesson/:date/:slot', element: <LessonScreen /> },
        { path: 'test/:testId', element: <TestPlaceholder /> },
        { path: 'results/:id', element: <ResultsPlaceholder /> },
        { path: 'revise/:subject', element: <RevisePlaceholder /> },
      ],
    },
    {
      path: 'parent',
      element: <ParentLayout />,
      children: [{ index: true, element: <ParentPlaceholder /> }],
    },
  ];
}
