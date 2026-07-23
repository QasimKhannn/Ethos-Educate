import React from 'react';

const ethosModelNames = new Set(['Ethos-Pro', 'Ethos-Nano', 'Ethos AI Tutor']);

interface EthosModelMarkProps {
  className?: string;
  containerClassName?: string;
  showBadge?: boolean;
  size?: number;
}

export const isEthosModelName = (name?: string | null): boolean =>
  name != null && ethosModelNames.has(name);

const EthosModelMark = ({
  className = 'block h-5 w-5 object-contain',
  containerClassName = 'icon-md flex shrink-0 items-center justify-center',
  showBadge = false,
  size = 20,
}: EthosModelMarkProps) => {
  const resolvedContainerClassName = showBadge
    ? `${containerClassName} ethos-model-mark-badge`
    : containerClassName;

  return (
    <span className={resolvedContainerClassName} aria-hidden="true">
      <img alt="" width={size} height={size} src="/assets/favicon.svg" className={className} />
    </span>
  );
};

export default EthosModelMark;
