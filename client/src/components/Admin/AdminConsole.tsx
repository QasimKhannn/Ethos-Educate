import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, useToastContext } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import {
  useAdminOverviewQuery,
  useAdminUsersQuery,
  useAdminInvitesQuery,
  useCreateInviteMutation,
  useResendInviteMutation,
  useRevokeInviteMutation,
  useUpdateRegistrationPolicyMutation,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  type AdminManagedUser,
  type InviteListItem,
} from '~/data-provider';
import { useAuthContext } from '~/hooks';
import AgentAdminSettings from '~/components/SidePanel/Agents/AdminSettings';
import PromptAdminSettings from '~/components/Prompts/AdminSettings';
import MemoryAdminSettings from '~/components/SidePanel/Memories/AdminSettings';
import MCPAdminSettings from '~/components/SidePanel/MCPBuilder/MCPAdminSettings';
import MarketplaceAdminSettings from '~/components/Agents/MarketplaceAdminSettings';
import PeoplePickerAdminSettings from '~/components/Sharing/PeoplePickerAdminSettings';

type AdminTab = 'overview' | 'users' | 'invites' | 'roles';

const tabs: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'invites', label: 'Invites' },
  { id: 'roles', label: 'Roles & Permissions' },
];

const cardClassName = 'rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm';

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
};

const UserCard = ({
  user,
  onToggleStatus,
  onChangeRole,
  disableActions,
}: {
  user: AdminManagedUser;
  onToggleStatus: (user: AdminManagedUser) => void;
  onChangeRole: (user: AdminManagedUser, role: SystemRoles) => void;
  disableActions: boolean;
}) => {
  const isActive = user.membership.status === 'active';

  return (
    <div className="rounded-2xl border border-border-light bg-surface-primary p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-lg font-semibold text-text-primary">
            {user.name || user.username || user.email}
          </div>
          <div className="truncate text-sm text-text-secondary">{user.email}</div>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
              {user.role}
            </span>
            <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
              {user.provider || 'local'}
            </span>
            <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
              Invite: {user.invite?.status || 'none'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-52">
          <select
            value={user.role}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            disabled={disableActions}
            onChange={(event) => onChangeRole(user, event.target.value as SystemRoles)}
          >
            <option value={SystemRoles.USER}>USER</option>
            <option value={SystemRoles.ADMIN}>ADMIN</option>
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={disableActions}
            onClick={() => onToggleStatus(user)}
            className="justify-center"
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
        <div>Created: {formatDate(user.createdAt)}</div>
        <div>Email verified: {user.emailVerified ? 'Yes' : 'No'}</div>
        <div>Invite updated: {formatDate(user.invite?.createdAt)}</div>
        <div>Deactivated at: {formatDate(user.membership.deactivatedAt)}</div>
      </div>
    </div>
  );
};

const InviteCard = ({
  invite,
  onResend,
  onRevoke,
  disableActions,
}: {
  invite: InviteListItem;
  onResend: (inviteId: string) => void;
  onRevoke: (inviteId: string) => void;
  disableActions: boolean;
}) => (
  <div className="rounded-2xl border border-border-light bg-surface-primary p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="truncate text-base font-semibold text-text-primary">{invite.email}</div>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
            {invite.status}
          </span>
          <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-text-primary">
            Expires {formatDate(invite.expiresAt)}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disableActions || invite.status === 'accepted' || invite.status === 'revoked'}
          onClick={() => onResend(invite._id)}
        >
          Resend
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disableActions || invite.status === 'accepted' || invite.status === 'revoked'}
          onClick={() => onRevoke(invite._id)}
        >
          Revoke
        </Button>
      </div>
    </div>

    <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
      <div>Created: {formatDate(invite.createdAt)}</div>
      <div>Accepted: {formatDate(invite.acceptedAt)}</div>
      <div>Revoked: {formatDate(invite.revokedAt)}</div>
      <div>Accepted user: {invite.acceptedUser?.email || '—'}</div>
    </div>
  </div>
);

export default function AdminConsole() {
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [inviteEmail, setInviteEmail] = useState('');
  const [allowedDomainsText, setAllowedDomainsText] = useState('');

  const overviewQuery = useAdminOverviewQuery();
  const usersQuery = useAdminUsersQuery();
  const invitesQuery = useAdminInvitesQuery();

  const createInviteMutation = useCreateInviteMutation();
  const resendInviteMutation = useResendInviteMutation();
  const revokeInviteMutation = useRevokeInviteMutation();
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const updateRegistrationPolicyMutation = useUpdateRegistrationPolicyMutation();

  useEffect(() => {
    const domains = overviewQuery.data?.policy?.allowedDomains ?? [];
    setAllowedDomainsText(domains.join('\n'));
  }, [overviewQuery.data?.policy?.allowedDomains]);

  const anyPending =
    createInviteMutation.isLoading ||
    resendInviteMutation.isLoading ||
    revokeInviteMutation.isLoading ||
    updateUserStatusMutation.isLoading ||
    updateUserRoleMutation.isLoading ||
    updateRegistrationPolicyMutation.isLoading;

  const allowedDomains = useMemo(
    () =>
      allowedDomainsText
        .split(/\r?\n|,/)
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    [allowedDomainsText],
  );

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace={true} />;
  }

  const handleInviteSubmit = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast({ status: 'error', message: 'Email is required.' });
      return;
    }

    try {
      const result = await createInviteMutation.mutateAsync(email);
      setInviteEmail('');
      showToast({
        status: 'success',
        message: result?.message || 'Invite created successfully.',
      });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  const handleAllowedDomainsSave = async () => {
    try {
      await updateRegistrationPolicyMutation.mutateAsync({ allowedDomains });
      showToast({ status: 'success', message: 'Allowed domains updated.' });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  const handleToggleStatus = async (managedUser: AdminManagedUser) => {
    const nextStatus = managedUser.membership.status === 'active' ? 'inactive' : 'active';

    try {
      await updateUserStatusMutation.mutateAsync({ userId: managedUser._id, status: nextStatus });
      showToast({ status: 'success', message: `User marked ${nextStatus}.` });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  const handleRoleChange = async (managedUser: AdminManagedUser, role: SystemRoles) => {
    if (role === managedUser.role) {
      return;
    }

    try {
      await updateUserRoleMutation.mutateAsync({ userId: managedUser._id, role });
      showToast({ status: 'success', message: `Role updated to ${role}.` });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const result = await resendInviteMutation.mutateAsync(inviteId);
      showToast({
        status: 'success',
        message: result?.message || 'Invite resent successfully.',
      });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInviteMutation.mutateAsync(inviteId);
      showToast({ status: 'success', message: 'Invite revoked successfully.' });
    } catch (error: any) {
      showToast({ status: 'error', message: error?.response?.data?.message || error?.message });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background p-4 text-text-primary sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className={cardClassName}>
          <div className="text-3xl font-bold">Admin Console</div>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary sm:text-base">
            Manage access, users, invites, and role permissions for this deployment without
            touching the current chat or marketplace flows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-border-medium bg-surface-tertiary text-text-primary'
                  : 'border-border-light bg-surface-primary text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Total Users', overviewQuery.data?.counts.totalUsers ?? 0],
                ['Active Users', overviewQuery.data?.counts.activeUsers ?? 0],
                ['Inactive Users', overviewQuery.data?.counts.inactiveUsers ?? 0],
                ['Admin Users', overviewQuery.data?.counts.adminUsers ?? 0],
                ['Pending Invites', overviewQuery.data?.counts.pendingInvites ?? 0],
                ['Accepted Invites', overviewQuery.data?.counts.acceptedInvites ?? 0],
                ['Revoked Invites', overviewQuery.data?.counts.revokedInvites ?? 0],
                ['Expired Invites', overviewQuery.data?.counts.expiredInvites ?? 0],
              ].map(([label, value]) => (
                <div key={label} className={cardClassName}>
                  <div className="text-sm text-text-secondary">{label}</div>
                  <div className="mt-2 text-3xl font-bold">{value}</div>
                </div>
              ))}
            </div>

            <div className={`${cardClassName} space-y-4`}>
              <div>
                <div className="text-lg font-semibold">Registration Policy</div>
                <div className="mt-1 text-sm text-text-secondary">
                  Invite-only registration currently:
                  <span className="ml-2 font-medium text-text-primary">
                    {overviewQuery.data?.policy.inviteOnlyRegistration ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <label className="block text-sm font-medium text-text-primary">
                Allowed domains
                <textarea
                  value={allowedDomainsText}
                  onChange={(event) => setAllowedDomainsText(event.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-border-light bg-surface-secondary p-3 text-sm text-text-primary"
                  placeholder="school.org\ncompany.com"
                />
              </label>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="submit"
                  disabled={anyPending}
                  onClick={handleAllowedDomainsSave}
                >
                  Save allowed domains
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            {(usersQuery.data ?? []).map((managedUser) => (
              <UserCard
                key={managedUser._id}
                user={managedUser}
                onToggleStatus={handleToggleStatus}
                onChangeRole={handleRoleChange}
                disableActions={anyPending}
              />
            ))}
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-6">
            <div className={`${cardClassName} space-y-4`}>
              <div className="text-lg font-semibold">Send Invite</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="user@school.org"
                  className="h-11 flex-1 rounded-xl border border-border-light bg-surface-secondary px-3 text-text-primary"
                />
                <Button
                  type="button"
                  variant="submit"
                  disabled={anyPending}
                  onClick={handleInviteSubmit}
                >
                  Send invite
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {(invitesQuery.data ?? []).map((invite) => (
                <InviteCard
                  key={invite._id}
                  invite={invite}
                  onResend={handleResendInvite}
                  onRevoke={handleRevokeInvite}
                  disableActions={anyPending}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">Agents</div>
              <AgentAdminSettings />
            </div>
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">Prompts</div>
              <PromptAdminSettings />
            </div>
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">Memories</div>
              <MemoryAdminSettings />
            </div>
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">Marketplace</div>
              <MarketplaceAdminSettings triggerClassName="w-full justify-center" />
            </div>
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">MCP Servers</div>
              <MCPAdminSettings />
            </div>
            <div className={cardClassName}>
              <div className="mb-4 text-lg font-semibold">People Picker</div>
              <PeoplePickerAdminSettings />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
