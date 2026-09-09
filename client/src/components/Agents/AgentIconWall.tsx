import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PermissionBits } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { Autoplay, EffectCoverflow, Pagination } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/autoplay';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import { useMarketplaceAgentsInfiniteQuery } from '~/data-provider/Agents';
import { useLocalize } from '~/hooks';
import {
  getAgentAvatarImageUrl,
  getAgentDisplayName,
  getAgentToolkitDescription,
  renderAgentAvatar,
} from '~/utils';
import { getMockMarketplaceAgents } from './mockAgents';
import { getShortStorefrontDescription } from './storefrontDescription';

export type MarketplaceHeaderVariant = 'editorial' | 'sunrise' | 'waterfall';

/* App Store-style cascade: per-column icon counts and the drop curve toward the center. */
const WATERFALL_COLUMN_COUNTS = [4, 3, 4, 4, 5, 4, 5, 4, 5, 4, 4, 3, 4];

interface AgentIconWallProps {
  onSelectAgent: (agent: t.Agent) => void;
  search: React.ReactNode;
  headerVariant?: MarketplaceHeaderVariant;
  showCarousel?: boolean;
}

const AGENT_ICON_WALL_LIMIT = 45;
const CONTINUOUS_CAROUSEL_SPEED = 5200;

const usesDefaultAgentIcon = (agent: t.Agent): boolean => {
  const avatarUrl = getAgentAvatarImageUrl(agent)?.split(/[?#]/)[0]?.toLowerCase() ?? '';
  return !avatarUrl || avatarUrl.endsWith('default-agent.svg');
};

const AgentIconWall: React.FC<AgentIconWallProps> = ({
  onSelectAgent,
  search,
  headerVariant = 'editorial',
  showCarousel = true,
}) => {
  const localize = useLocalize();
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const { data, isLoading } = useMarketplaceAgentsInfiniteQuery({
    requiredPermission: PermissionBits.VIEW,
    limit: AGENT_ICON_WALL_LIMIT,
  });
  const mockAgents = useMemo(() => getMockMarketplaceAgents(localize), [localize]);
  const agents = useMemo(() => {
    const loadedAgents = data?.pages?.flatMap((page) => page.data ?? []) ?? [];

    return loadedAgents.length > 0 ? loadedAgents : mockAgents;
  }, [data?.pages, mockAgents]);
  const featuredAgents = agents.slice(0, AGENT_ICON_WALL_LIMIT);
  const featuredAgentCount = featuredAgents.length;
  const preferredActiveAgentIndex = Math.min(2, Math.max(featuredAgentCount - 1, 0));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreferenceChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleMotionPreferenceChange();
    mediaQuery.addEventListener('change', handleMotionPreferenceChange);

    return () => mediaQuery.removeEventListener('change', handleMotionPreferenceChange);
  }, []);

  useEffect(() => {
    const swiper = swiperRef.current;

    if (!swiper || featuredAgentCount === 0) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      swiper.update();
      swiper.slideToLoop(preferredActiveAgentIndex, 0, false);
      if (!prefersReducedMotion) {
        swiper.autoplay?.start();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [featuredAgentCount, prefersReducedMotion, preferredActiveAgentIndex]);

  const stopCarouselMotion = useCallback(() => {
    const swiper = swiperRef.current;

    if (!swiper) {
      return;
    }

    swiper.autoplay?.stop();
    swiper.el.classList.remove('is-autoplaying');
  }, []);

  const moveCarousel = useCallback(
    (direction: 'next' | 'previous', speed = 240) => {
      const swiper = swiperRef.current;

      if (!swiper) {
        return;
      }

      stopCarouselMotion();
      if (swiper.animating) {
        const currentTranslate = swiper.getTranslate();
        swiper.setTransition(0);
        swiper.setTranslate(currentTranslate);
        swiper.updateProgress();
        swiper.updateActiveIndex();
        swiper.updateSlidesClasses();
      }

      const offset = direction === 'next' ? 1 : -1;
      const targetIndex = (swiper.realIndex + offset + featuredAgentCount) % featuredAgentCount;
      swiper.slideToLoop(targetIndex, Math.min(speed, 320), true);
    },
    [featuredAgentCount, stopCarouselMotion],
  );

  const isWaterfall = headerVariant === 'waterfall';

  const waterfallColumns = useMemo(() => {
    const pool: t.Agent[] = [];

    for (const agent of agents) {
      if (pool.length >= AGENT_ICON_WALL_LIMIT) {
        break;
      }

      if (!usesDefaultAgentIcon(agent)) {
        pool.push(agent);
      }
    }

    if (pool.length === 0) {
      return [];
    }

    const center = (WATERFALL_COLUMN_COUNTS.length - 1) / 2;
    let cursor = 0;

    return WATERFALL_COLUMN_COUNTS.map((count, columnIndex) => {
      const distance = Math.abs(columnIndex - center);
      const stagger = columnIndex % 2 === 0 ? -10 : 12;
      const fall = Math.round(38 - distance * distance * 2.4 + stagger);
      const delay = Math.round(90 + distance * 60 + (columnIndex % 2 === 0 ? 0 : 45));
      const columnAgents: t.Agent[] = [];

      for (let slot = 0; slot < count; slot += 1) {
        columnAgents.push(pool[cursor % pool.length]);
        cursor += 1;
      }

      return { columnIndex, fall, delay, agents: columnAgents };
    });
  }, [agents]);

  return (
    <div className="agents-marketplace-app-wall-shell">
      {isWaterfall ? (
        <div className="agents-marketplace-app-waterfall" aria-hidden="true">
          {waterfallColumns.map((column) => (
            <div
              key={column.columnIndex}
              className="agents-marketplace-app-waterfall-col"
              style={
                {
                  '--waterfall-fall': `${column.fall}px`,
                  '--waterfall-delay': `${column.delay}ms`,
                } as React.CSSProperties
              }
            >
              {column.agents.map((agent, rowIndex) => (
                <span
                  key={`${agent.id}-${column.columnIndex}-${rowIndex}`}
                  className="agents-marketplace-app-waterfall-icon"
                >
                  {renderAgentAvatar(agent, {
                    size: 'fill',
                    showBorder: false,
                    fit: 'contain',
                    shape: 'rounded',
                    visualScale: 'contained',
                    className: 'agents-marketplace-app-icon-image',
                  })}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <header className="agents-marketplace-app-hero-heading" data-header-variant={headerVariant}>
        {isWaterfall ? (
          <span className="agents-marketplace-app-hero-mark" aria-hidden="true">
            <img src="/assets/ethos-rays.png" alt="" />
            <img src="/assets/ethos-arc.png" alt="" />
          </span>
        ) : null}
        <h1 className="agents-marketplace-app-hero-title">{localize('com_agents_marketplace')}</h1>
      </header>
      {isWaterfall || !showCarousel ? null : (
        <div className="agents-marketplace-app-hero-row">
          <div
            className="agents-marketplace-app-gallery-stage"
            aria-label={localize('com_agents_marketplace_featured')}
            aria-roledescription="carousel"
            role="region"
            tabIndex={0}
            onPointerDownCapture={(event) => {
              const target = event.target;

              if (
                target instanceof HTMLElement &&
                target.closest('button, .swiper-pagination-bullet')
              ) {
                stopCarouselMotion();
              }
            }}
            onClickCapture={(event) => {
              const target = event.target;

              if (
                target instanceof HTMLElement &&
                target.closest('button, .swiper-pagination-bullet')
              ) {
                stopCarouselMotion();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveCarousel('previous', 0);
              }

              if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveCarousel('next', 0);
              }
            }}
          >
            <div className="agents-marketplace-app-gallery-viewport">
              <Swiper
                className="agents-marketplace-app-gallery"
                effect="coverflow"
                grabCursor
                slidesPerView={3}
                breakpoints={{
                  0: { slidesPerView: 3 },
                  768: { slidesPerView: 3 },
                }}
                centeredSlides
                loop={featuredAgentCount > 1}
                spaceBetween={0}
                speed={CONTINUOUS_CAROUSEL_SPEED}
                modules={[Autoplay, EffectCoverflow, Pagination]}
                autoplay={
                  featuredAgentCount > 1 && !prefersReducedMotion
                    ? {
                        delay: 1,
                        disableOnInteraction: true,
                        pauseOnMouseEnter: false,
                        waitForTransition: true,
                      }
                    : false
                }
                coverflowEffect={{
                  rotate: 10,
                  stretch: 0,
                  depth: 120,
                  modifier: 1.1,
                  slideShadows: false,
                }}
                initialSlide={preferredActiveAgentIndex}
                pagination={
                  featuredAgentCount > 1
                    ? {
                        clickable: true,
                        dynamicBullets: true,
                        dynamicMainBullets: 3,
                      }
                    : false
                }
                onSwiper={(swiper) => {
                  swiperRef.current = swiper;
                  window.requestAnimationFrame(() => {
                    swiper.update();
                    swiper.slideToLoop(preferredActiveAgentIndex, 0, false);
                    if (!prefersReducedMotion) {
                      swiper.autoplay?.start();
                    }
                  });
                }}
                onAutoplayStart={(swiper) => {
                  swiper.el.classList.add('is-autoplaying');
                }}
                onAutoplayStop={(swiper) => {
                  swiper.el.classList.remove('is-autoplaying');
                }}
                onClick={(swiper) => {
                  stopCarouselMotion();
                }}
                onSlideChange={(swiper) => {
                  setActiveAgentIndex(swiper.realIndex);
                }}
              >
                {featuredAgents.map((agent) => (
                  <SwiperSlide key={agent.id}>
                    <button
                      type="button"
                      className="agents-marketplace-app-agent-tile"
                      aria-label={getAgentDisplayName(agent)}
                      onPointerDown={stopCarouselMotion}
                      onClick={() => {
                        stopCarouselMotion();
                        onSelectAgent(agent);
                      }}
                    >
                      <span className="agents-marketplace-app-agent-tile-icon">
                        {renderAgentAvatar(agent, {
                          size: 'fill',
                          showBorder: false,
                          fit: 'contain',
                          shape: 'rounded',
                          visualScale: 'contained',
                          className: 'agents-marketplace-app-icon-image',
                        })}
                      </span>
                      <span className="agents-marketplace-app-agent-tile-copy">
                        <strong>{getAgentDisplayName(agent)}</strong>
                        <span>
                          {getShortStorefrontDescription(
                            getAgentDisplayName(agent),
                            getAgentToolkitDescription(agent),
                          )}
                        </span>
                      </span>
                    </button>
                  </SwiperSlide>
                ))}
              </Swiper>
              <button
                type="button"
                className="agents-marketplace-app-carousel-nav is-previous"
                aria-label={localize('com_agents_carousel_previous')}
                disabled={featuredAgentCount < 2}
                onPointerDown={stopCarouselMotion}
                onClick={() => moveCarousel('previous')}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="agents-marketplace-app-carousel-nav is-next"
                aria-label={localize('com_agents_carousel_next')}
                disabled={featuredAgentCount < 2}
                onPointerDown={stopCarouselMotion}
                onClick={() => moveCarousel('next')}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
      {search ? <div className="agents-marketplace-app-wall-search">{search}</div> : null}
      {isWaterfall || !showCarousel ? null : (
        <span className="sr-only" aria-live="polite">
          {featuredAgentCount > 0
            ? getAgentDisplayName(featuredAgents[activeAgentIndex] ?? featuredAgents[0])
            : isLoading
              ? localize('com_agents_loading')
              : ''}
        </span>
      )}
    </div>
  );
};

export default AgentIconWall;
