import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogClose,
  OGDialogContent,
  OGDialogTitle,
  TooltipAnchor,
  useMediaQuery,
} from '@librechat/client';
import type { NavLink, NavProps } from '~/common';
import { ActivePanelProvider, useActivePanel } from '~/Providers';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const getNavSection = (link: NavLink) => {
  if (link.id === 'hide-panel') {
    return 'utility';
  }

  if (link.id === 'files' || link.id === 'bookmarks') {
    return 'resources';
  }

  return 'tools';
};

const getTooltipDescription = (link: NavLink, localize: ReturnType<typeof useLocalize>) => {
  const title = localize(link.title);
  const description = localize(link.description ?? link.title);

  return link.description ? `${title}: ${description}` : description;
};

function CollapsedNavLinks({
  links,
  active,
  setActive,
  resize,
  openModal,
  setTriggerRef,
  modalLinkId,
}: {
  links: NavLink[];
  active: string | undefined;
  setActive: (value: string) => void;
  resize?: (size: number) => void;
  openModal: (link: NavLink) => void;
  setTriggerRef: (linkId: string, element: HTMLButtonElement | null) => void;
  modalLinkId: string | null;
}) {
  const localize = useLocalize();

  return links.map((link) => {
    const isUtilityLink = link.id === 'hide-panel';
    const isActive = link.id === active || link.id === modalLinkId;
    const navSection = getNavSection(link);
    const startsSection = link.id === 'files' || isUtilityLink;
    const title = localize(link.title);

    return (
      <TooltipAnchor
        description={getTooltipDescription(link, localize)}
        side="left"
        key={link.id}
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'sidepanel-nav-icon-button relative',
              isActive && 'sidepanel-nav-icon-button-active',
              isUtilityLink && 'sidepanel-nav-item-utility',
            )}
            aria-description={localize(link.description ?? link.title)}
            aria-label={title}
            data-control-panel-tour-id={!isUtilityLink ? link.id : undefined}
            data-nav-section={navSection}
            data-section-start={startsSection || undefined}
            ref={link.Component ? (element) => setTriggerRef(link.id, element) : undefined}
            onClick={(event) => {
              if (link.Component) {
                event.preventDefault();
                setActive('');
                resize?.(25);
                openModal(link);
                return;
              }

              if (link.onClick) {
                link.onClick(event);
                if (!isUtilityLink) {
                  setActive('');
                }
                return;
              }

              setActive(link.id);
              resize?.(25);
            }}
          >
            <span className="sidepanel-nav-icon" aria-hidden="true">
              <link.icon className="h-4 w-4" />
            </span>
            <span className="sr-only">{title}</span>
          </Button>
        }
      />
    );
  });
}

function ExpandedNav({
  links,
  active,
  setActive,
  openModal,
  setTriggerRef,
  modalLinkId,
}: {
  links: NavLink[];
  active: string | undefined;
  setActive: (value: string) => void;
  openModal: (link: NavLink) => void;
  setTriggerRef: (linkId: string, element: HTMLButtonElement | null) => void;
  modalLinkId: string | null;
}) {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const tools = links.filter((link) => link.id !== 'hide-panel');

  return (
    <div className="sidepanel-expanded-workspace">
      <div className="sidepanel-expanded-navigation" aria-label={localize('com_nav_control_panel')}>
        <div className="sidepanel-expanded-tool-grid" role="toolbar">
          {tools.map((link) => {
            const isActive = link.id === active || link.id === modalLinkId;
            const title = localize(link.title);
            const description = localize(link.description ?? link.title);

            return (
              <TooltipAnchor
                description={getTooltipDescription(link, localize)}
                side={isSmallScreen ? 'top' : 'left'}
                key={link.id}
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      'sidepanel-expanded-tool w-full',
                      isActive && 'sidepanel-expanded-tool-active',
                    )}
                    aria-description={description}
                    aria-label={title}
                    aria-pressed={isActive}
                    data-control-panel-tour-id={link.id}
                    data-tour-item="sidepanel"
                    data-nav-section={getNavSection(link)}
                    ref={link.Component ? (element) => setTriggerRef(link.id, element) : undefined}
                    onClick={(event) => {
                      if (link.Component) {
                        event.preventDefault();
                        setActive('');
                        openModal(link);
                        return;
                      }

                      if (link.onClick) {
                        link.onClick(event);
                        setActive('');
                        return;
                      }

                      setActive(link.id);
                    }}
                  >
                    <span
                      className="sidepanel-nav-icon sidepanel-expanded-tool-icon"
                      aria-hidden="true"
                    >
                      <link.icon className="h-4 w-4" />
                    </span>
                    <span className="sidepanel-expanded-tool-label truncate">{title}</span>
                    {link.label != null && link.label && (
                      <span className="sidepanel-expanded-tool-meta">{link.label}</span>
                    )}
                  </Button>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NavContent({ links, isCollapsed, resize }: Omit<NavProps, 'defaultActive'>) {
  const { active, setActive } = useActivePanel();
  const localize = useLocalize();
  const [modalLinkId, setModalLinkId] = useState<string | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const modalLink = links.find((link) => link.id === modalLinkId);
  const ModalComponent = modalLink?.Component;

  const openModal = (link: NavLink) => {
    setActive('');
    setModalLinkId(link.id);
  };

  const setTriggerRef = (linkId: string, element: HTMLButtonElement | null) => {
    triggerRefs.current.set(linkId, element);
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setModalLinkId(null);
    }
  };

  useEffect(() => {
    if (!isCollapsed || !active) {
      return;
    }

    setActive('');
  }, [active, isCollapsed, setActive]);

  useEffect(() => {
    if (active && links.some((link) => link.id === active && link.Component)) {
      setActive('');
    }
  }, [active, links, setActive]);

  return (
    <div
      data-collapsed={isCollapsed}
      className="sidepanel-nav hide-scrollbar group flex-1 overflow-x-hidden"
    >
      <div className="scrollbar-trigger relative w-full border-white/20">
        <div className="sidepanel-nav-list flex w-full flex-col px-3 py-3 group-[[data-collapsed=true]]:items-center group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
          <div
            data-tour-id={!isCollapsed ? 'sidepanel-sections' : undefined}
            data-tour-clip={!isCollapsed ? 'sidepanel' : undefined}
            data-tour-padding={!isCollapsed ? '-2' : undefined}
            data-tour-radius={!isCollapsed ? '24' : undefined}
            data-tour-target-selector={!isCollapsed ? '[data-tour-item="sidepanel"]' : undefined}
            className={cn(
              'sidepanel-nav-tour-target relative w-full shrink-0 self-stretch overflow-hidden rounded-[1.25rem]',
              'flex flex-col',
              isCollapsed ? 'items-center gap-2' : 'gap-1.5',
            )}
          >
            {isCollapsed ? (
              <CollapsedNavLinks
                links={links}
                active={active}
                setActive={setActive}
                resize={resize}
                openModal={openModal}
                setTriggerRef={setTriggerRef}
                modalLinkId={modalLinkId}
              />
            ) : (
              <ExpandedNav
                links={links}
                active={active}
                setActive={setActive}
                openModal={openModal}
                setTriggerRef={setTriggerRef}
                modalLinkId={modalLinkId}
              />
            )}
          </div>
        </div>
      </div>
      {modalLink && ModalComponent && (
        <OGDialog open={true} onOpenChange={handleModalOpenChange}>
          <OGDialogContent
            showCloseButton={false}
            className="control-panel-dialog flex max-h-[calc(100dvh-2rem)] w-[min(94vw,62rem)] max-w-none flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary p-0 text-text-primary shadow-lg"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRefs.current.get(modalLink.id)?.focus();
            }}
          >
            <div className="control-panel-dialog-header flex shrink-0 items-start justify-between gap-4 border-b border-border-light px-5 py-4 sm:px-6">
              <OGDialogTitle className="min-w-0 text-lg font-semibold tracking-[-0.02em] text-text-primary">
                {localize(modalLink.title)}
              </OGDialogTitle>
              <OGDialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                  aria-label={localize('com_ui_close')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </OGDialogClose>
            </div>
            <div className="control-panel-dialog-body min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <ModalComponent />
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
    </div>
  );
}

export default function Nav({ links, isCollapsed, resize, defaultActive }: NavProps) {
  return (
    <ActivePanelProvider defaultActive={defaultActive}>
      <NavContent links={links} isCollapsed={isCollapsed} resize={resize} />
    </ActivePanelProvider>
  );
}
