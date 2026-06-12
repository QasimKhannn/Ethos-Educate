import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, request, SystemRoles } from 'librechat-data-provider';

export type MembershipStatus = 'active' | 'inactive';

export type AdminInviteSummary = {
  id: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export type AdminMembershipSummary = {
  status: MembershipStatus;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
};

export type AdminManagedUser = {
  _id: string;
  id?: string;
  name?: string;
  username?: string;
  email: string;
  role: SystemRoles;
  provider?: string;
  emailVerified?: boolean;
  createdAt?: string;
  membership: AdminMembershipSummary;
  invite: AdminInviteSummary | null;
};

export type RegistrationPolicy = {
  inviteOnlyRegistration: boolean;
  publicRegistrationEnabled: boolean;
  allowUnverifiedEmailLogin: boolean;
  allowedDomains: string[];
};

export type AdminOverview = {
  counts: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    adminUsers: number;
    pendingInvites: number;
    acceptedInvites: number;
    revokedInvites: number;
    expiredInvites: number;
  };
  policy: RegistrationPolicy;
};

export type InviteListItem = {
  _id: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  inviter?: { email?: string; name?: string; username?: string } | null;
  acceptedUser?: { email?: string; name?: string; username?: string } | null;
};

export type AdminAuditLogItem = {
  _id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  createdAt: string;
  actor?: {
    email?: string;
    name?: string;
    username?: string;
    role?: SystemRoles;
  } | null;
  details?: Record<string, unknown> | null;
};

const adminBase = '/api/admin';
const invitesBase = '/api/invites';

const adminKeys = {
  overview: [QueryKeys.user, 'admin-overview'] as const,
  users: [QueryKeys.user, 'admin-users'] as const,
  invites: [QueryKeys.user, 'admin-invites'] as const,
  auditLogs: [QueryKeys.user, 'admin-audit-logs'] as const,
};

export const useAdminOverviewQuery = () =>
  useQuery<AdminOverview>({
    queryKey: adminKeys.overview,
    queryFn: () => request.get(`${adminBase}/overview`),
    refetchOnWindowFocus: false,
  });

export const useAdminUsersQuery = () =>
  useQuery<AdminManagedUser[]>({
    queryKey: adminKeys.users,
    queryFn: () => request.get(`${adminBase}/users`),
    refetchOnWindowFocus: false,
  });

export const useAdminInvitesQuery = () =>
  useQuery<InviteListItem[]>({
    queryKey: adminKeys.invites,
    queryFn: () => request.get(invitesBase),
    refetchOnWindowFocus: false,
  });

export const useAdminAuditLogsQuery = () =>
  useQuery<AdminAuditLogItem[]>({
    queryKey: adminKeys.auditLogs,
    queryFn: () => request.get(`${adminBase}/audit-logs`),
    refetchOnWindowFocus: false,
  });

export const useUpdateUserStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: MembershipStatus }) =>
      request.patch(`${adminBase}/users/${userId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};

export const useUpdateUserRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: SystemRoles }) =>
      request.patch(`${adminBase}/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};

export const useUpdateRegistrationPolicyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      allowedDomains,
      inviteOnlyRegistration,
    }: {
      allowedDomains?: string[];
      inviteOnlyRegistration?: boolean;
    }) =>
      request.patch(`${adminBase}/registration-policy`, {
        ...(allowedDomains !== undefined ? { allowedDomains } : {}),
        ...(inviteOnlyRegistration !== undefined ? { inviteOnlyRegistration } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.startupConfig] });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};

export const useCreateInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => request.post(invitesBase, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invites });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};

export const useResendInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => request.post(`${invitesBase}/${inviteId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invites });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};

export const useRevokeInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => request.post(`${invitesBase}/${inviteId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invites });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs });
    },
  });
};
