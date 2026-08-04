import { useMemo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { Sidebar } from '@librechat/client';
import { useLocation } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { ArrowLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@librechat/client';
import { useLocalize, useCustomLink, useAuthContext } from '~/hooks';
import AdvancedSwitch from '~/components/Prompts/AdvancedSwitch';
import AdminSettings from '~/components/Prompts/AdminSettings';
import { useDashboardContext } from '~/Providers';
import store from '~/store';

const promptsPathPattern = /prompts\/(?!new(?:\/|$)).*$/;

const getConversationId = (prevLocationPath: string) => {
  if (!prevLocationPath || prevLocationPath.includes('/d/')) {
    return 'new';
  }
  const lastPathnameParts = prevLocationPath.split('/');
  return lastPathnameParts[lastPathnameParts.length - 1];
};

export default function DashBreadcrumb({
  showToggle = false,
  onToggle,
  openPanelRef,
}: {
  showToggle?: boolean;
  onToggle?: () => void;
  openPanelRef?: React.RefObject<HTMLButtonElement>;
}) {
  const location = useLocation();
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { prevLocationPath } = useDashboardContext();
  const lastConversationId = useMemo(() => getConversationId(prevLocationPath), [prevLocationPath]);

  const setPromptsName = useSetRecoilState(store.promptsName);
  const setPromptsCategory = useSetRecoilState(store.promptsCategory);

  const clickCallback = useCallback(() => {
    setPromptsName('');
    setPromptsCategory('');
  }, [setPromptsName, setPromptsCategory]);

  const chatLinkHandler = useCustomLink('/c/' + lastConversationId, clickCallback);
  const isPromptsPath = useMemo(
    () => promptsPathPattern.test(location.pathname),
    [location.pathname],
  );

  return (
    <header className="prompts-dashboard-header">
      <div className="prompts-dashboard-intro">
        <Breadcrumb className="prompts-dashboard-breadcrumb dark:text-gray-200">
          <BreadcrumbList>
            {showToggle && onToggle && (
              <>
                <BreadcrumbItem>
                  <button
                    ref={openPanelRef}
                    type="button"
                    onClick={onToggle}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-surface-primary text-text-primary transition-all hover:bg-surface-hover"
                    aria-label={localize('com_nav_open_sidebar')}
                    aria-expanded={false}
                    aria-controls="prompts-panel"
                  >
                    <Sidebar className="h-4 w-4" aria-hidden="true" />
                  </button>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/"
                className="prompts-dashboard-back-link"
                onClick={chatLinkHandler}
              >
                <ArrowLeft className="icon-xs" aria-hidden="true" />
                <span className="hidden md:flex">{localize('com_ui_back_to_chat')}</span>
                <span className="flex md:hidden">{localize('com_ui_chat')}</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="prompts-dashboard-title-row">
          <div>
            <h1 className="prompts-dashboard-title">{localize('com_ui_prompts')}</h1>
            <p className="prompts-dashboard-description">
              {localize('com_ui_prompt_library_description')}
            </p>
          </div>
        </div>
      </div>
      <div className="prompts-dashboard-actions">
        {isPromptsPath && <AdvancedSwitch />}
        {user?.role === SystemRoles.ADMIN && <AdminSettings />}
      </div>
    </header>
  );
}
