const OAUTH_POPUP_HEIGHT = 760;
const OAUTH_POPUP_WIDTH = 560;
const oauthPopups = new Map<string, Window | null>();

const getBaseHref = (): string => document.querySelector('base')?.getAttribute('href') || '/';

const getPopupOffset = (outer: number, popup: number): number => {
  return Math.max(0, Math.round((outer - popup) / 2));
};

export const getOAuthReturnUrl = (): string => {
  return new URL(`${getBaseHref()}c/new`, window.location.origin).toString();
};

export const openMCPOAuthWindow = (oauthUrl: string, serverName: string): Window | null => {
  const screenLeft = typeof window.screenLeft === 'number' ? window.screenLeft : window.screenX;
  const screenTop = typeof window.screenTop === 'number' ? window.screenTop : window.screenY;
  const left = screenLeft + getPopupOffset(window.outerWidth, OAUTH_POPUP_WIDTH);
  const top = screenTop + getPopupOffset(window.outerHeight, OAUTH_POPUP_HEIGHT);
  const popupFeatures = [
    'popup=yes',
    `width=${OAUTH_POPUP_WIDTH}`,
    `height=${OAUTH_POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  const popup = window.open(oauthUrl, `mcp-oauth-${serverName}`, popupFeatures);
  oauthPopups.set(serverName, popup);
  return popup;
};

export const closeMCPOAuthWindow = (serverName?: string | null): boolean => {
  if (!serverName) {
    return false;
  }

  const popup = oauthPopups.get(serverName);
  oauthPopups.delete(serverName);

  if (!popup || popup.closed) {
    return false;
  }

  popup.close();
  return true;
};

export const notifyOAuthOpener = (serverName?: string | null): boolean => {
  if (!window.opener || window.opener.closed) {
    return false;
  }

  window.opener.postMessage({ type: 'mcp-oauth-success', serverName }, window.location.origin);
  window.opener.focus();
  return true;
};
