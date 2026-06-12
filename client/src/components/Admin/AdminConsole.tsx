import { useEffect, useMemo, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Button, useMediaQuery, useToastContext } from '@librechat/client';
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
import type { ContextType } from '~/common';
import { OpenSidebar } from '~/components/Chat/Menus';
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
const PAGE_SIZE = 5;

const formatDate = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
};

const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');

const getEmailDomain = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

const PaginationControls = ({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border-light bg-surface-primary px-4 py-3">
      <div className="text-sm text-text-secondary">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" variant="outline" disabled={page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
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
      <div>Accepted user: {invite.acceptedUser?.email || '-'}</div>
    </div>
  </div>
);

export default function AdminConsole() {
  const { user } = useAuthContext();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const { showToast } = useToastContext();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [inviteEmail, setInviteEmail] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [allowedDomainInput, setAllowedDomainInput] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);

  const overviewQuery = useAdminOverviewQuery();
  const usersQuery = useAdminUsersQuery();
  const invitesQuery = useAdminInvitesQuery();

  const createInviteMutation = useCreateInviteMutation();
  const resendInviteMutation = useResendInviteMutation();
  const revokeInviteMutation = useRevokeInviteMutation();
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const updateRegistrationPolicyMutation = useUpdateRegistrationPolicyMutation();

  const effectiveAllowedDomains = overviewQuery.data?.policy?.allowedDomains ?? [];

  useEffect(() => {
    setAllowedDomains(effectiveAllowedDomains);
  }, [effectiveAllowedDomains]);

  useEffect(() => {
    setUserPage(1);
  }, [usersQuery.data?.length]);

  useEffect(() => {
    setInvitePage(1);
  }, [invitesQuery.data?.length]);

  const anyPending =
    createInviteMutation.isLoading ||
    resendInviteMutation.isLoading ||
    revokeInviteMutation.isLoading ||
    updateUserStatusMutation.isLoading ||
    updateUserRoleMutation.isLoading ||
    updateRegistrationPolicyMutation.isLoading;

  const users = usersQuery.data ?? [];
  const invites = invitesQuery.data ?? [];
  const totalUserPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const totalInvitePages = Math.max(1, Math.ceil(invites.length / PAGE_SIZE));

  const paginatedUsers = useMemo(
    () => users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE),
    [userPage, users],
  );
  const paginatedInvites = useMemo(
    () => invites.slice((invitePage - 1) * PAGE_SIZE, invitePage * PAGE_SIZE),
    [invitePage, invites],
  );

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace={true} />;
  }

  const shouldShowOpenSidebar = !isSmallScreen && !navVisible;

  const handleAddAllowedDomain = () => {
    const normalizedDomain = normalizeDomain(allowedDomainInput);
    if (!normalizedDomain) {
      showToast({ status: 'error', message: 'Please enter a domain.' });
      return;
    }

    if (normalizedDomain.includes('@')) {
      showToast({ status: 'error', message: 'Enter only the domain, for example: ajaia.ai' });
      return;
    }

    if (allowedDomains.includes(normalizedDomain)) {
      showToast({ status: 'error', message: 'That domain is already added.' });
      return;
    }

    setAllowedDomains((currentDomains) => [...currentDomains, normalizedDomain]);
    setAllowedDomainInput('');
  };

  const handleRemoveAllowedDomain = (domainToRemove: string) => {
    setAllowedDomains((currentDomains) =>
      currentDomains.filter((domain) => domain !== domainToRemove),
    );
  };

  const handleInviteSubmit = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast({ status: 'error', message: 'Email is required.' });
      return;
    }

    const domain = getEmailDomain(email);
    if (!domain) {
      showToast({ status: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    if (effectiveAllowedDomains.length > 0 && !effectiveAllowedDomains.includes(domain)) {
      showToast({
        status: 'error',
        message: `Invites can only be sent to allowed domains. "${domain}" is not allowed.`,
      });
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

  const handleInviteOnlyToggle = async () => {
    const inviteOnlyRegistration = overviewQuery.data?.policy?.inviteOnlyRegistration;
    if (inviteOnlyRegistration === undefined) {
      return;
    }

    try {
      await updateRegistrationPolicyMutation.mutateAsync({
        inviteOnlyRegistration: !inviteOnlyRegistration,
      });
      showToast({
        status: 'success',
        message: `Invite-only registration ${inviteOnlyRegistration ? 'disabled' : 'enabled'}.`,
      });
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
        {shouldShowOpenSidebar && (
          <div className="flex items-center">
            <OpenSidebar setNavVisible={setNavVisible} />
          </div>
        )}
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

            <div className={`${cardClassName} space-y-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">Registration Policy</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    Invite-only registration currently:
                    <span className="ml-2 font-medium text-text-primary">
                      {overviewQuery.data?.policy.inviteOnlyRegistration ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    If disabled, everyone can register. If enabled, only invited users can register.
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={anyPending || overviewQuery.data?.policy.inviteOnlyRegistration == null}
                  onClick={handleInviteOnlyToggle}
                >
                  {overviewQuery.data?.policy.inviteOnlyRegistration
                    ? 'Disable invite-only'
                    : 'Enable invite-only'}
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-text-primary">Allowed domains</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    Add one or more email domains that are allowed to register and receive valid invites.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {allowedDomains.length > 0 ? (
                    allowedDomains.map((domain) => (
                      <div
                        key={domain}
                        className="flex items-center gap-2 rounded-full border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                      >
                        <span>{domain}</span>
                        <button
                          type="button"
                          className="text-text-secondary transition hover:text-text-primary"
                          onClick={() => handleRemoveAllowedDomain(domain)}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border-light px-4 py-3 text-sm text-text-secondary">
                      No domain restrictions configured. All domains are currently allowed.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={allowedDomainInput}
                    onChange={(event) => setAllowedDomainInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddAllowedDomain();
                      }
                    }}
                    placeholder="Add domain, for example: ajaia.ai"
                    className="h-11 flex-1 rounded-xl border border-border-light bg-surface-secondary px-3 text-text-primary"
                  />
                  <Button type="button" variant="outline" disabled={anyPending} onClick={handleAddAllowedDomain}>
                    Add domain
                  </Button>
                </div>
              </div>

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
            <div className={cardClassName}>
              <div className="text-lg font-semibold">Users</div>
              <div className="mt-1 text-sm text-text-secondary">
                Showing {paginatedUsers.length} of {users.length} users.
              </div>
            </div>

            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((managedUser) => (
                <UserCard
                  key={managedUser._id}
                  user={managedUser}
                  onToggleStatus={handleToggleStatus}
                  onChangeRole={handleRoleChange}
                  disableActions={anyPending}
                />
              ))
            ) : (
              <div className={cardClassName}>
                <div className="text-sm text-text-secondary">No users found.</div>
              </div>
            )}

            <PaginationControls
              page={userPage}
              totalPages={totalUserPages}
              onPrevious={() => setUserPage((page) => Math.max(1, page - 1))}
              onNext={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
            />
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-6">
            <div className={`${cardClassName} space-y-4`}>
              <div className="text-lg font-semibold">Send Invite</div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-text-primary">Currently allowed domains</div>
                <div className="flex flex-wrap gap-2">
                  {effectiveAllowedDomains.length > 0 ? (
                    effectiveAllowedDomains.map((domain) => (
                      <span
                        key={domain}
                        className="rounded-full border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                      >
                        {domain}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-text-secondary">
                      No domain restrictions are set. Invites can be sent to any email domain.
                    </span>
                  )}
                </div>
              </div>

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

            <div className={cardClassName}>
              <div className="text-lg font-semibold">Invite History</div>
              <div className="mt-1 text-sm text-text-secondary">
                Showing {paginatedInvites.length} of {invites.length} invite records.
              </div>
            </div>

            <div className="space-y-4">
              {paginatedInvites.length > 0 ? (
                paginatedInvites.map((invite) => (
                  <InviteCard
                    key={invite._id}
                    invite={invite}
                    onResend={handleResendInvite}
                    onRevoke={handleRevokeInvite}
                    disableActions={anyPending}
                  />
                ))
              ) : (
                <div className={cardClassName}>
                  <div className="text-sm text-text-secondary">No invites found.</div>
                </div>
              )}
            </div>

            <PaginationControls
              page={invitePage}
              totalPages={totalInvitePages}
              onPrevious={() => setInvitePage((page) => Math.max(1, page - 1))}
              onNext={() => setInvitePage((page) => Math.min(totalInvitePages, page + 1))}
            />
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

