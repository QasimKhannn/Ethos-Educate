import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export const ACTIVE_PANEL_STORAGE_KEY = 'side:active-panel';

export const clearStoredActivePanel = (): void => {
  localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, '');
};

interface ActivePanelContextType {
  active: string | undefined;
  setActive: (id: string) => void;
}

const ActivePanelContext = createContext<ActivePanelContextType | undefined>(undefined);

export function ActivePanelProvider({
  children,
  defaultActive,
}: {
  children: ReactNode;
  defaultActive?: string;
}) {
  const [active, _setActive] = useState<string | undefined>(defaultActive);

  const setActive = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, id);
    _setActive(id);
  }, []);

  return (
    <ActivePanelContext.Provider value={{ active, setActive }}>
      {children}
    </ActivePanelContext.Provider>
  );
}

export function useActivePanel() {
  const context = useContext(ActivePanelContext);
  if (context === undefined) {
    throw new Error('useActivePanel must be used within an ActivePanelProvider');
  }
  return context;
}
