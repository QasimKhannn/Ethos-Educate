import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  AccordionContent,
  AccordionItem,
  TooltipAnchor,
  Accordion,
  Button,
} from '@librechat/client';
import type { NavLink, NavProps } from '~/common';
import { ActivePanelProvider, useActivePanel } from '~/Providers';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function NavContent({ links, isCollapsed, resize }: Omit<NavProps, 'defaultActive'>) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const getVariant = (link: NavLink) => (link.id === active ? 'default' : 'ghost');

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
            {links.map((link, index) => {
              const variant = getVariant(link);
              const isUtilityLink = link.id === 'hide-panel';
              const controlPanelTourId = !isCollapsed && !isUtilityLink ? link.id : undefined;
              return isCollapsed ? (
                <TooltipAnchor
                  description={localize(link.title)}
                  side="left"
                  key={`nav-link-${index}`}
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'sidepanel-nav-icon-button sidepanel-nav-animated-item',
                        variant === 'default' && 'sidepanel-nav-icon-button-active',
                        isUtilityLink && 'sidepanel-nav-item-utility',
                      )}
                      data-control-panel-tour-id={controlPanelTourId}
                      style={{ animationDelay: `${index * 36}ms` }}
                      onClick={(e) => {
                        if (link.onClick) {
                          link.onClick(e);
                          if (!isUtilityLink) {
                            setActive('');
                          }
                          return;
                        }
                        setActive(link.id);
                        resize && resize(25);
                      }}
                    >
                      <span className="sidepanel-nav-icon" aria-hidden="true">
                        <link.icon className="h-4 w-4" />
                      </span>
                      <span className="sr-only">{localize(link.title)}</span>
                    </Button>
                  }
                />
              ) : (
                <div key={index} data-tour-item="sidepanel" className="w-full">
                  {isUtilityLink ? (
                    <Button
                      variant="outline"
                      className={cn(
                        'sidepanel-nav-item sidepanel-nav-item-expanded sidepanel-nav-animated-item w-full px-3 py-3',
                        'sidepanel-nav-item-utility',
                      )}
                      data-control-panel-tour-id={controlPanelTourId}
                      style={{ animationDelay: `${index * 36}ms` }}
                      onClick={(e) => link.onClick?.(e)}
                    >
                      <span className="sidepanel-nav-item-label truncate">
                        {localize(link.title)}
                      </span>
                      <span
                        className="sidepanel-nav-icon sidepanel-nav-item-icon"
                        aria-hidden="true"
                      >
                        <link.icon className="h-4 w-4" />
                      </span>
                    </Button>
                  ) : (
                    <Accordion
                      type="single"
                      value={active}
                      onValueChange={setActive}
                      collapsible
                      className="sidepanel-nav-animated-item w-full"
                      style={{ animationDelay: `${index * 36}ms` }}
                    >
                      <AccordionItem value={link.id} className="w-full border-none">
                        <AccordionPrimitive.Header asChild>
                          <AccordionPrimitive.Trigger asChild>
                            <Button
                              variant="outline"
                              className="sidepanel-nav-item sidepanel-nav-item-expanded w-full px-3 py-3 data-[state=open]:text-text-primary"
                              data-control-panel-tour-id={controlPanelTourId}
                              onClick={(e) => {
                                if (link.onClick) {
                                  link.onClick(e);
                                  setActive('');
                                }
                              }}
                            >
                              <span className="sidepanel-nav-item-label truncate">
                                {localize(link.title)}
                              </span>
                              <span
                                className="sidepanel-nav-icon sidepanel-nav-item-icon"
                                aria-hidden="true"
                              >
                                <link.icon className="h-4 w-4" />
                              </span>
                              {link.label != null && link.label && (
                                <span
                                  className={cn(
                                    'sidepanel-nav-item-meta opacity-100 transition-all duration-300 ease-in-out',
                                    variant === 'default' ? 'text-text-primary' : '',
                                  )}
                                >
                                  {link.label}
                                </span>
                              )}
                            </Button>
                          </AccordionPrimitive.Trigger>
                        </AccordionPrimitive.Header>

                        <AccordionContent className="sidepanel-nav-content w-full text-text-primary">
                          {link.Component && <link.Component />}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
