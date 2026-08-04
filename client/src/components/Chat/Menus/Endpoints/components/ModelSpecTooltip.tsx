import { TooltipAnchor } from '@librechat/client';
import type { ReactElement } from 'react';
import type { TModelSpec } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

type ModelInfoKey = 'com_ui_ethos_pro_model_info' | 'com_ui_ethos_nano_model_info';

interface ModelSpecTooltipProps {
  children: ReactElement;
  spec: TModelSpec;
}

export function getModelInfoKey(spec: TModelSpec): ModelInfoKey | undefined {
  const modelName = spec.label.trim().toLowerCase();

  if (modelName === 'ethos-pro') {
    return 'com_ui_ethos_pro_model_info';
  }

  if (modelName === 'ethos-nano') {
    return 'com_ui_ethos_nano_model_info';
  }

  return undefined;
}

export default function ModelSpecTooltip({ children, spec }: ModelSpecTooltipProps) {
  const localize = useLocalize();
  const modelInfoKey = getModelInfoKey(spec);

  if (!modelInfoKey) {
    return children;
  }

  return <TooltipAnchor description={localize(modelInfoKey)} side="right" render={children} />;
}
