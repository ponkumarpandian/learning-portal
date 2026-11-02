import { createContext, useContext } from 'react';
import { createAppClock, type Clock } from '@/engine/clock';

let appClock: Clock | undefined;

/** The app clock: real time, or the dev/QA `?now=` override (see engine/clock). */
export function getAppClock(): Clock {
  appClock ??= createAppClock();
  return appClock;
}

/** Tests wrap screens in <ClockContext.Provider value={fixedClock(...)}>. */
export const ClockContext = createContext<Clock | null>(null);

export function useClock(): Clock {
  return useContext(ClockContext) ?? getAppClock();
}
