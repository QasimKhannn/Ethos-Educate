import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import throttle from 'lodash/throttle';
import { useRecoilValue } from 'recoil';
import { getConfigDefaults } from 'librechat-data-provider';
import { ResizablePanel, ResizablePanelGroup, useMediaQuery } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { clearStoredActivePanel } from '~/Providers';
import ArtifactsPanel from './ArtifactsPanel';
import { normalizeLayout, cn } from '~/utils';
import SidePanel from './SidePanel';
import store from '~/store';

interface SidePanelProps {
  className?: string;
  defaultLayout?: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize?: number;
  fullPanelCollapse?: boolean;
  clickAwayCollapseMode?: 'hidden' | 'rail';
  onPanelOpenChange?: (isOpen: boolean) => void;
  artifacts?: React.ReactNode;
  children: React.ReactNode;
}

const defaultMinSize = 20;
const defaultInterface = getConfigDefaults().interface;

const SidePanelGroup = memo(
  ({
    className,
    defaultLayout = [97, 3],
    defaultCollapsed = false,
    fullPanelCollapse = false,
    navCollapsedSize = 3,
    clickAwayCollapseMode = 'hidden',
    onPanelOpenChange,
    artifacts,
    children,
  }: SidePanelProps) => {
    const localize = useLocalize();
    const { data: startupConfig } = useGetStartupConfig();
    const interfaceConfig = useMemo(
      () => startupConfig?.interface ?? defaultInterface,
      [startupConfig],
    );

    const [minSize, setMinSize] = useState(defaultMinSize);
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [fullCollapse, setFullCollapse] = useState(fullPanelCollapse);
    const [collapsedSize, setCollapsedSize] = useState(navCollapsedSize);
    const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(artifacts != null);

    const isSmallScreen = useMediaQuery('(max-width: 767px)');
    const hideSidePanel = useRecoilValue(store.hideSidePanel);

    const calculateLayout = useCallback(() => {
      if (artifacts == null) {
        return [100];
      }

      if (defaultLayout.length >= 2) {
        const navSize = defaultLayout.length === 3 ? defaultLayout[2] : 0;
        const mainSize = defaultLayout[0] + navSize;
        const artifactsSize = 100 - mainSize;
        return [mainSize, artifactsSize];
      }

      return [50, 50];
    }, [artifacts, defaultLayout]);

    const currentLayout = useMemo(() => normalizeLayout(calculateLayout()), [calculateLayout]);

    const throttledSaveLayout = useMemo(
      () =>
        throttle((sizes: number[]) => {
          const normalizedSizes = normalizeLayout(sizes);
          localStorage.setItem('react-resizable-panels:layout', JSON.stringify(normalizedSizes));
        }, 350),
      [],
    );

    useEffect(() => {
      if (isSmallScreen) {
        clearStoredActivePanel();
        setIsCollapsed(true);
        setCollapsedSize(0);
        setMinSize(defaultMinSize);
        setFullCollapse(true);
        localStorage.setItem('fullPanelCollapse', 'true');
        return;
      }

      setFullCollapse(fullPanelCollapse);

      if (fullPanelCollapse) {
        clearStoredActivePanel();
        setIsCollapsed(true);
        setCollapsedSize(0);
        setMinSize(0);
        return;
      }

      setIsCollapsed(defaultCollapsed);
      setCollapsedSize(navCollapsedSize);
      setMinSize(defaultMinSize);
    }, [isSmallScreen, defaultCollapsed, navCollapsedSize, fullPanelCollapse]);

    const minSizeMain = useMemo(() => (artifacts != null ? 15 : 30), [artifacts]);
    const isSidePanelMaskActive = !isCollapsed && fullCollapse !== true;

    useEffect(() => {
      onPanelOpenChange?.(isSidePanelMaskActive);
    }, [isSidePanelMaskActive, onPanelOpenChange]);

    /** Memoized close button handler to prevent re-creating it */
    const handleClosePanel = useCallback(() => {
      clearStoredActivePanel();
      setIsCollapsed(() => {
        if (clickAwayCollapseMode === 'rail') {
          localStorage.setItem('fullPanelCollapse', 'false');
          setFullCollapse(false);
          setCollapsedSize(navCollapsedSize);
          setMinSize(defaultMinSize);
          return true;
        }

        localStorage.setItem('fullPanelCollapse', 'true');
        setFullCollapse(true);
        setCollapsedSize(0);
        setMinSize(0);
        return true;
      });
    }, [clickAwayCollapseMode, navCollapsedSize]);

    const handleClickAwayClose = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isSidePanelMaskActive) {
          return;
        }

        const target = event.target as HTMLElement | null;
        if (target?.closest('#controls-nav')) {
          return;
        }

        handleClosePanel();
      },
      [handleClosePanel, isSidePanelMaskActive],
    );

    return (
      <>
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes) => throttledSaveLayout(sizes)}
          className={cn('relative h-full w-full flex-1 overflow-auto bg-presentation', className)}
          onClickCapture={handleClickAwayClose}
        >
          <ResizablePanel
            defaultSize={currentLayout[0]}
            minSize={minSizeMain}
            order={1}
            id="messages-view"
          >
            {children}
          </ResizablePanel>

          {!isSmallScreen && (
            <ArtifactsPanel
              artifacts={artifacts}
              currentLayout={currentLayout}
              minSizeMain={minSizeMain}
              shouldRender={shouldRenderArtifacts}
              onRenderChange={setShouldRenderArtifacts}
            />
          )}
        </ResizablePanelGroup>
        {!hideSidePanel && interfaceConfig.sidePanel === true && (
          <SidePanel
            minSize={minSize}
            setMinSize={setMinSize}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            collapsedSize={collapsedSize}
            setCollapsedSize={setCollapsedSize}
            fullCollapse={fullCollapse}
            setFullCollapse={setFullCollapse}
            interfaceConfig={interfaceConfig}
          />
        )}
        {artifacts != null && isSmallScreen && (
          <div className="fixed inset-0 z-[100]">{artifacts}</div>
        )}
        {!hideSidePanel && interfaceConfig.sidePanel === true && (
          <button
            onClick={handleClosePanel}
            aria-label={localize('com_ui_close_var', { 0: localize('com_nav_control_panel') })}
            className={cn('sidenav-mask', isSidePanelMaskActive ? 'active' : '')}
          />
        )}
      </>
    );
  },
);

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
