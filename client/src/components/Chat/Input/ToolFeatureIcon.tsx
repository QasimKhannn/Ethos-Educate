import { cn } from '~/utils';

export const TOOL_FEATURE_ICON_PATHS = {
  downloadfiles: '/assets/mcp/downloadfiles.svg',
  websearch: '/assets/mcp/websearch.svg',
} as const;

interface ToolFeatureIconProps {
  icon: keyof typeof TOOL_FEATURE_ICON_PATHS;
  className?: string;
}

export default function ToolFeatureIcon({ icon, className }: ToolFeatureIconProps) {
  return (
    <img
      src={TOOL_FEATURE_ICON_PATHS[icon]}
      alt=""
      aria-hidden="true"
      className={cn('object-contain', className)}
    />
  );
}
