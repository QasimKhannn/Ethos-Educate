import { useCallback, useEffect, useState, memo, useRef } from 'react';
import * as Menu from '@ariakit/react/menu';
import { ChevronDown, FileText, LogOut } from 'lucide-react';
import { GearIcon, DropdownMenuSeparator, Avatar } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';

function AccountSettings() {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);

  const closeAccountTourMenu = useCallback(() => {
    setIsAccountMenuOpen(false);
  }, []);

  useEffect(() => {
    const handleTourOpen = () => setIsAccountMenuOpen(true);

    window.addEventListener('nav-account-tour-open', handleTourOpen);
    window.addEventListener('nav-account-tour-close', closeAccountTourMenu);

    return () => {
      window.removeEventListener('nav-account-tour-open', handleTourOpen);
      window.removeEventListener('nav-account-tour-close', closeAccountTourMenu);
    };
  }, [closeAccountTourMenu]);

  return (
    <Menu.MenuProvider
      open={isAccountMenuOpen}
      setOpen={setIsAccountMenuOpen}
      placement="top-start"
    >
      <Menu.MenuButton
        ref={accountSettingsButtonRef}
        aria-label={localize('com_nav_account_settings')}
        data-tour-id="nav-account"
        data-tour-clip="sidebar"
        data-tour-padding="-6"
        data-tour-radius="16"
        data-tour-offset-x="-2"
        data-testid="nav-user"
        className="user-menu-trigger sidebar-account-card mt-1.5 flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ease-in-out"
      >
        <div className="sidebar-account-avatar flex h-8 w-8 flex-shrink-0 items-center justify-center">
          <Avatar user={user} size={32} />
        </div>
        <div className="sidebar-account-copy min-w-0 flex-1 text-left">
          <div className="sidebar-account-name text-sm font-semibold text-text-primary">
            {user?.name ?? user?.username ?? localize('com_nav_user')}
          </div>
          <div className="sidebar-account-email text-[0.72rem] font-medium text-text-secondary">
            {user?.email ?? localize('com_nav_account_settings')}
          </div>
        </div>
        <ChevronDown
          className="sidebar-account-chevron h-4 w-4 flex-shrink-0 text-text-secondary"
          aria-hidden="true"
        />
      </Menu.MenuButton>
      <Menu.Menu
        fixed
        gutter={6}
        sameWidth
        data-tour-id="nav-account-menu"
        data-tour-padding="-8"
        data-tour-radius="18"
        className="account-settings-popover popover-ui z-[125] rounded-2xl"
        style={{
          transformOrigin: 'bottom',
          margin: 0,
          maxWidth: 'calc(100vw - 1rem)',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user?.email ?? localize('com_nav_user')}
        </div>
        <DropdownMenuSeparator />
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
              {localize('com_nav_balance')}:{' '}
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <Menu.MenuItem onClick={() => setShowFiles(true)} className="select-item text-sm">
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Menu.MenuItem>
        <Menu.MenuItem onClick={() => setShowSettings(true)} className="select-item text-sm">
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Menu.MenuItem>
        <DropdownMenuSeparator />
        <Menu.MenuItem onClick={() => logout()} className="select-item text-sm">
          <LogOut className="icon-md" aria-hidden="true" />
          {localize('com_nav_log_out')}
        </Menu.MenuItem>
      </Menu.Menu>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Menu.MenuProvider>
  );
}

export default memo(AccountSettings);
