// cowork — admin access management: enable/disable Cowork, choose who can use it, manage grants.
import { useState } from 'react';
import { Button, useToastContext } from '@librechat/client';
import {
  useAdminUsersQuery,
  useCoworkAccessAdminQuery,
  useUpdateCoworkAccessMutation,
  useGrantCoworkUserMutation,
  useRevokeCoworkUserMutation,
} from '~/data-provider';

const card = 'rounded-2xl border border-border-light bg-surface-primary p-5';

export default function CoworkAdminSettings() {
  const { showToast } = useToastContext();
  const accessQuery = useCoworkAccessAdminQuery();
  const usersQuery = useAdminUsersQuery();
  const updateMutation = useUpdateCoworkAccessMutation();
  const grantMutation = useGrantCoworkUserMutation();
  const revokeMutation = useRevokeCoworkUserMutation();
  const [userQuery, setUserQuery] = useState('');

  const policy = accessQuery.data;
  const busy = updateMutation.isLoading || grantMutation.isLoading || revokeMutation.isLoading;

  const onError = (error: unknown) =>
    showToast({
      status: 'error',
      message:
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error)?.message ||
        'Something went wrong.',
    });

  const grantedIds = new Set(policy?.grantedUserIds ?? []);
  const grantableUsers = (usersQuery.data ?? []).filter((u) => !grantedIds.has(u._id));

  // Type-to-search so the picker scales past a handful of users (matches name / username / email).
  const query = userQuery.trim().toLowerCase();
  const matches = query
    ? grantableUsers
        .filter((u) =>
          [u.name, u.username, u.email]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query)),
        )
        .slice(0, 8)
    : [];

  if (accessQuery.isLoading) {
    return <div className={`${card} text-sm text-text-secondary`}>Loading Cowork access…</div>;
  }
  if (accessQuery.isError || !policy) {
    return <div className={`${card} text-sm text-red-400`}>Failed to load Cowork access settings.</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold">Cowork availability</div>
            <div className="mt-1 text-sm text-text-secondary">
              When disabled, no one (except admins) can open Cowork.
              <span className="ml-2 font-medium text-text-primary">
                Currently {policy.enabled ? 'enabled' : 'disabled'}.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => updateMutation.mutate({ enabled: !policy.enabled }, { onError })}
          >
            {policy.enabled ? 'Disable Cowork' : 'Enable Cowork'}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">Who can use Cowork</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(['everyone', 'allowlist'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={busy}
                onClick={() => updateMutation.mutate({ mode }, { onError })}
                className={`flex-1 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  policy.mode === mode
                    ? 'border-border-medium bg-surface-tertiary text-text-primary'
                    : 'border-border-light bg-surface-primary text-text-secondary hover:text-text-primary'
                } disabled:opacity-50`}
              >
                <div className="font-medium text-text-primary">
                  {mode === 'everyone' ? 'Everyone' : 'Granted users only'}
                </div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {mode === 'everyone'
                    ? 'Any signed-in user can use Cowork.'
                    : 'Only users you grant below (admins always can).'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {policy.mode === 'allowlist' && (
        <div className={`${card} space-y-4`}>
          <div>
            <div className="text-lg font-semibold">Granted users</div>
            <div className="mt-1 text-sm text-text-secondary">
              These users can use Cowork. Admins always have access regardless of this list.
            </div>
          </div>

          <div className="space-y-2">
            <input
              value={userQuery}
              disabled={busy}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search users by name or email to grant…"
              className="h-11 w-full rounded-xl border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
            />
            {query &&
              (matches.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border-light">
                  {matches.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        grantMutation.mutate(u._id, {
                          onSuccess: () => setUserQuery(''),
                          onError,
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 border-b border-border-light bg-surface-primary px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-secondary disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {u.name || u.username || u.email}
                        </div>
                        <div className="truncate text-xs text-text-secondary">{u.email}</div>
                      </div>
                      <span className="flex-none text-xs font-medium text-blue-500">Grant</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border-light px-4 py-3 text-sm text-text-secondary">
                  No users match “{userQuery}”.
                </div>
              ))}
          </div>

          <div className="space-y-2">
            {policy.grantedUsers.length > 0 ? (
              policy.grantedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-light bg-surface-secondary px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">{u.name}</div>
                    <div className="truncate text-xs text-text-secondary">{u.email}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => revokeMutation.mutate(u.id, { onError })}
                  >
                    Revoke
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border-light px-4 py-3 text-sm text-text-secondary">
                No users granted yet. In this mode, only admins can use Cowork until you grant access.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
