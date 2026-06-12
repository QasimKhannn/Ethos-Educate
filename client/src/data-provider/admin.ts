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

const adminBase = '/api/admin';
const invitesBase = '/api/invites';

const adminKeys = {
  overview: [QueryKeys.user, 'admin-overview'] as const,
  users: [QueryKeys.user, 'admin-users'] as const,
  invites: [QueryKeys.user, 'admin-invites'] as const,
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

export const useUpdateUserStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: MembershipStatus }) =>
      request.patch(`${adminBase}/users/${userId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
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
    },
  });
};

export const useUpdateRegistrationPolicyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ allowedDomains }: { allowedDomains: string[] }) =>
      request.patch(`${adminBase}/registration-policy`, { allowedDomains }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.overview });
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
    },
  });
};

export const useResendInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => request.post(`${invitesBase}/${inviteId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invites });
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
    },
  });
};
