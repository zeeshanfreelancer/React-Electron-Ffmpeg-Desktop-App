import { createContext, useContext } from 'react';

export const StudioContext = createContext(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used within <StudioContext.Provider />');
  }
  return ctx;
}


