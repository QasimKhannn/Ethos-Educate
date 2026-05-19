import React, { createContext, useContext, useMemo } from 'react';
import type { EModelEndpoint } from 'librechat-data-provider';
import { useChatContext } from './ChatContext';

interface SidePanelContextValue {
  endpoint?: EModelEndpoint | null;
  endpointType?: EModelEndpoint | null;
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined);

interface SidePanelProviderProps {
  children: React.ReactNode;
  endpoint?: EModelEndpoint | null;
  endpointType?: EModelEndpoint | null;
}

export function SidePanelProvider({
  children,
  endpoint: endpointOverride,
  endpointType: endpointTypeOverride,
}: SidePanelProviderProps) {
  const { conversation } = useChatContext();
  const endpoint = endpointOverride ?? conversation?.endpoint;
  const endpointType = endpointTypeOverride ?? conversation?.endpointType;

  const contextValue = useMemo<SidePanelContextValue>(
    () => ({
      endpoint,
      endpointType,
    }),
    [endpoint, endpointType],
  );

  return <SidePanelContext.Provider value={contextValue}>{children}</SidePanelContext.Provider>;
}

export function useSidePanelContext() {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('useSidePanelContext must be used within SidePanelProvider');
  }
  return context;
}
