const NAV_VISIBILITY_STORAGE_KEY = 'navVisible:v2';

export const getInitialNavVisibility = () =>
  localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY) === 'true';

export const saveNavVisibility = (isVisible: boolean) => {
  localStorage.setItem(NAV_VISIBILITY_STORAGE_KEY, JSON.stringify(isVisible));
};
