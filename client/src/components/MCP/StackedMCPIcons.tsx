import { useMemo } from 'react';
import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import MCPServerAvatar from './MCPServerAvatar';
import { getSelectedServerIcons } from './mcpServerUtils';
import { cn } from '~/utils';

interface StackedMCPIconsProps {
  selectedServers: MCPServerDefinition[];
  maxIcons?: number;
  iconSize?: 'sm' | 'md';
  variant?: 'default' | 'submenu';
}

const sizeConfig = {
  sm: {
    icon: 'h-[18px] w-[18px]',
    container: 'h-[22px] w-[22px]',
    overlap: '-ml-2.5',
  },
  md: {
    icon: 'h-5 w-5',
    container: 'h-6 w-6',
    overlap: '-ml-3',
  },
};

const variantConfig = {
  default: {
    border: 'border-border-medium',
    bg: 'bg-surface-secondary',
  },
  submenu: {
    border: 'border-surface-primary',
    bg: 'bg-surface-primary',
  },
};

export default function StackedMCPIcons({
  selectedServers,
  maxIcons = 3,
  iconSize = 'md',
  variant = 'default',
}: StackedMCPIconsProps) {
  const sizes = sizeConfig[iconSize];
  const colors = variantConfig[variant];
  const { icons, overflowCount } = useMemo(
    () => getSelectedServerIcons(selectedServers, maxIcons),
    [selectedServers, maxIcons],
  );

  if (icons.length === 0) {
    return (
      <MCPServerAvatar
        decorative={true}
        serverName="mcp"
        displayName="MCP"
        shape="circle"
        containerClassName={cn('flex-shrink-0', sizes.container)}
        iconClassName={cn('text-text-primary', sizes.icon)}
      />
    );
  }

  return (
    <div className="flex items-center" aria-hidden="true">
      {icons.map((icon, index) => (
        <div
          key={icon.key}
          title={icon.displayName}
          className={cn(
            'relative flex items-center justify-center rounded-full border',
            colors.border,
            colors.bg,
            sizes.container,
            index > 0 && sizes.overlap,
          )}
          style={{ zIndex: icons.length - index }}
        >
          <MCPServerAvatar
            decorative={true}
            title={icon.displayName}
            shape="circle"
            serverName={icon.serverName}
            displayName={icon.displayName}
            iconPath={icon.iconPath}
            containerClassName={sizes.container}
            imageClassName={sizes.icon}
            iconClassName={sizes.icon}
          />
        </div>
      ))}
      {overflowCount > 0 && (
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full border border-surface-primary bg-surface-tertiary text-xs font-medium text-text-secondary',
            sizes.container,
            sizes.overlap,
          )}
          style={{ zIndex: 0 }}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
