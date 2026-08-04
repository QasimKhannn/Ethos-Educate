export const OPEN_CONTROL_PANEL_EVENT = 'ethos:control-panel-open';

export const requestOpenControlPanel = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(OPEN_CONTROL_PANEL_EVENT));
};
