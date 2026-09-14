import React from 'react';
import { useLocalize } from '~/hooks';
import { getMockMarketplaceIconSource } from './mockAgents';

export type MarketplaceHeaderVariant = 'editorial' | 'sunrise' | 'waterfall';

const WATERFALL_COLUMN_COUNTS = [4, 3, 4, 4, 5, 4, 5, 4, 5, 4, 4, 3, 4];

const MARKETPLACE_HEADER_ICON_ASSETS = [
  'lesson-plan-builder.png',
  'assessment-quiz-builder.png',
  'rubric-creator.png',
  'worksheet-generator.png',
  'class-newsletter-creator.png',
  'educational-grants-funding-finder.png',
  'letter-memo-generator.png',
  'podcast-creator.png',
  'report-card-comment-writer.png',
  'school-poster-designer.png',
  'student-certificate-creator.png',
  'survey-builder.png',
  'translation-assistant.png',
  'vocabulary-spelling-list-builder.png',
  'word-doc-and-pdf-generator.png',
  'youtube-video-finder.png',
];

type StaticWaterfallColumn = {
  fall: number;
  icons: string[];
  index: number;
};

const createStaticWaterfallColumns = (): StaticWaterfallColumn[] => {
  const center = (WATERFALL_COLUMN_COUNTS.length - 1) / 2;
  let iconIndex = 0;

  return WATERFALL_COLUMN_COUNTS.map((count, index) => {
    const distance = Math.abs(index - center);
    const stagger = index % 2 === 0 ? -10 : 12;
    const icons = Array.from({ length: count }, () => {
      const icon =
        MARKETPLACE_HEADER_ICON_ASSETS[iconIndex % MARKETPLACE_HEADER_ICON_ASSETS.length];
      iconIndex += 1;
      return icon;
    });

    return {
      fall: Math.round(38 - distance * distance * 2.4 + stagger),
      icons,
      index,
    };
  });
};

const STATIC_WATERFALL_COLUMNS = createStaticWaterfallColumns();

interface AgentIconWallProps {
  search: React.ReactNode;
  headerVariant?: MarketplaceHeaderVariant;
}

const AgentIconWall: React.FC<AgentIconWallProps> = ({ search, headerVariant = 'editorial' }) => {
  const localize = useLocalize();
  const hasWaterfall = headerVariant === 'waterfall';

  return (
    <div className="agents-marketplace-app-wall-shell">
      {hasWaterfall ? (
        <div className="agents-marketplace-app-waterfall" aria-hidden="true">
          {STATIC_WATERFALL_COLUMNS.map((column) => (
            <div
              key={column.index}
              className="agents-marketplace-app-waterfall-col"
              style={{ '--waterfall-fall': `${column.fall}px` } as React.CSSProperties}
            >
              {column.icons.map((asset, rowIndex) => (
                <span
                  key={`${asset}-${column.index}-${rowIndex}`}
                  className="agents-marketplace-app-waterfall-icon"
                >
                  <img alt="" decoding="async" src={getMockMarketplaceIconSource(asset)} />
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <header className="agents-marketplace-app-hero-heading" data-header-variant={headerVariant}>
        {hasWaterfall ? (
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
