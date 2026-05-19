import { memo, useMemo } from 'react';
import { useMediaQuery } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getConfigDefaults, PermissionTypes, Permissions } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import { PresetsMenu, HeaderNewChat, OpenSidebar } from './Menus';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import { useGetStartupConfig } from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useHasAccess } from '~/hooks';
import { cn } from '~/utils';

const defaultInterface = getConfigDefaults().interface;

function Header() {
  const { data: startupConfig } = useGetStartupConfig();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const hasAccessToTemporaryChat = useHasAccess({
    permissionType: PermissionTypes.TEMPORARY_CHAT,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <div className="absolute inset-x-0 top-0 z-20 px-2 pt-2 md:px-4 md:pt-4">
      <AnimatePresence initial={false}>
        {!navVisible && !isSmallScreen && (
          <motion.div
            className="chat-sidebar-reveal"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            <OpenSidebar
              setNavVisible={setNavVisible}
              className="chat-sidebar-reveal-button chat-header-icon-control size-9"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="chat-header-row">
        <div className="chat-header-shell px-1.5 py-1.5 md:px-2 md:py-1.5">
          <div className="hide-scrollbar chat-header-toolbar">
            <div className="chat-header-group">
              <AnimatePresence initial={false}>
                {!navVisible && (
                  <motion.div
                    className="chat-header-group chat-header-primary-group"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    key="header-buttons"
                  >
                    <HeaderNewChat />
                  </motion.div>
                )}
              </AnimatePresence>
              {!(navVisible && isSmallScreen) && (
                <div
                  className={cn(
                    'chat-header-group chat-header-actions-group',
                    !isSmallScreen ? 'transition-all duration-200 ease-in-out' : '',
                    !navVisible && !isSmallScreen ? 'pl-0.5' : '',
                  )}
                >
                  <ModelSelector startupConfig={startupConfig} />
                  {interfaceConfig.presets === true && interfaceConfig.modelSelect && (
                    <PresetsMenu />
                  )}
                  {hasAccessToBookmarks === true && <BookmarkMenu />}
                  {hasAccessToMultiConvo === true && <AddMultiConvo />}
                  {isSmallScreen && (
                    <>
                      <ExportAndShareMenu
                        isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                      />
                      {hasAccessToTemporaryChat === true && <TemporaryChat />}
                    </>
                  )}
                </div>
              )}
            </div>

            {!isSmallScreen && (
              <div className="chat-header-group chat-header-utility-group">
                <ExportAndShareMenu
                  isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                />
                {hasAccessToTemporaryChat === true && <TemporaryChat />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const MemoizedHeader = memo(Header);
MemoizedHeader.displayName = 'Header';

export default MemoizedHeader;
