import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildLoginRedirectUrl } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { consumePostLogoutStartNewChat } from '~/utils';

export default function useAuthRedirect() {
  const { user, roles, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAuthenticated) {
        return;
      }

      if (consumePostLogoutStartNewChat()) {
        navigate('/login?redirect=false', { replace: true });
        return;
      }

      navigate(buildLoginRedirectUrl(location.pathname, location.search, location.hash), {
        replace: true,
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [isAuthenticated, navigate, location]);

  return {
    user,
    roles,
    isAuthenticated,
  };
}
