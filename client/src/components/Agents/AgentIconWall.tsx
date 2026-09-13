import React, { useMemo } from 'react';
import { PermissionBits } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useMarketplaceAgentsInfiniteQuery } from '~/data-provider/Agents';
import { useLocalize } from '~/hooks';
import { getAgentAvatarImageUrl, renderAgentAvatar } from '~/utils';
import { getMockMarketplaceAgents } from './mockAgents';

export type MarketplaceHeaderVariant = 'editorial' | 'sunrise' | 'waterfall';

/* App Store-style cascade: per-column icon counts and the drop curve toward the center. */
const WATERFALL_COLUMN_COUNTS = [4, 3, 4, 4, 5, 4, 5, 4, 5, 4, 4, 3, 4];

interface AgentIconWallProps {
  search: React.ReactNode;
  headerVariant?: MarketplaceHeaderVariant;
}

const AGENT_ICON_WALL_LIMIT = 45;

const usesDefaultAgentIcon = (agent: t.Agent): boolean => {
  const avatarUrl = getAgentAvatarImageUrl(agent)?.split(/[?#]/)[0]?.toLowerCase() ?? '';
  return !avatarUrl || avatarUrl.endsWith('default-agent.svg');
};

const AgentIconWall: React.FC<AgentIconWallProps> = ({ search, headerVariant = 'editorial' }) => {
  const localize = useLocalize();
  const { data } = useMarketplaceAgentsInfiniteQuery({
    requiredPermission: PermissionBits.VIEW,
    limit: AGENT_ICON_WALL_LIMIT,
  });
  const mockAgents = useMemo(() => getMockMarketplaceAgents(localize), [localize]);
  const agents = useMemo(() => {
    const loadedAgents = data?.pages?.flatMap((page) => page.data ?? []) ?? [];

    return loadedAgents.length > 0 ? loadedAgents : mockAgents;
  }, [data?.pages, mockAgents]);
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
      {search ? <div className="agents-marketplace-app-wall-search">{search}</div> : null}
    </div>
  );
};

export default AgentIconWall;
