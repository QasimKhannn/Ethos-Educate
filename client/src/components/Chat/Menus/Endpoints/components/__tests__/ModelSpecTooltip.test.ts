import type { TModelSpec } from 'librechat-data-provider';
import { getModelInfoKey } from '../ModelSpecTooltip';

const createSpec = (label: string): TModelSpec => ({
  name: label,
  label,
  preset: { endpoint: 'agents' },
});

describe('getModelInfoKey', () => {
  it('returns the Pro model description key', () => {
    expect(getModelInfoKey(createSpec('Ethos-Pro'))).toBe('com_ui_ethos_pro_model_info');
  });

  it('returns the Nano model description key', () => {
    expect(getModelInfoKey(createSpec('Ethos-Nano'))).toBe('com_ui_ethos_nano_model_info');
  });

  it('does not add descriptions to other models', () => {
    expect(getModelInfoKey(createSpec('Ethos AI Tutor'))).toBeUndefined();
  });
});
