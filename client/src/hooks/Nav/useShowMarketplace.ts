import { useContext, useMemo } from 'react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useHasAccess, AuthContext } from '~/hooks';

export default function useShowMarketplace(): boolean {
  const authContext = useContext(AuthContext);

  const hasAccessToAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });

  const authReady = useMemo(
    () =>
      authContext?.isAuthenticated !== undefined &&
      (authContext?.isAuthenticated === false || authContext?.user !== undefined),
    [authContext?.isAuthenticated, authContext?.user],
  );

  return authReady && hasAccessToAgents;
}
