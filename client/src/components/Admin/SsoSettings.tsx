import { useEffect, useState } from 'react';
import { Button, useToastContext } from '@librechat/client';
import {
  useSsoStatusQuery,
  useUpdateOpenIdMutation,
  useUpdateAuthModeMutation,
  useValidateOpenIdMutation,
  type SsoAuthMode,
  type SsoValidateResult,
} from '~/data-provider';

const cardClassName = 'rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm';
const inputClassName =
  'h-11 w-full rounded-xl border border-border-light bg-surface-secondary px-3 text-text-primary';
const labelClassName = 'text-sm font-medium text-text-primary';
const helpClassName = 'text-xs text-text-secondary';

type FieldState = {
  issuer: string;
  clientId: string;
  scope: string;
  callbackUrl: string;
  buttonLabel: string;
  imageUrl: string;
  emailClaim: string;
  usernameClaim: string;
  nameClaim: string;
  requiredRole: string;
  adminRole: string;
  allowedDomains: string;
  autoRedirect: boolean;
};

const emptyFields: FieldState = {
  issuer: '',
  clientId: '',
  scope: '',
  callbackUrl: '',
  buttonLabel: '',
  imageUrl: '',
  emailClaim: '',
  usernameClaim: '',
  nameClaim: '',
  requiredRole: '',
  adminRole: '',
  allowedDomains: '',
  autoRedirect: false,
};

const authModeOptions: { value: SsoAuthMode; label: string; description: string }[] = [
  { value: 'local_only', label: 'Local only', description: 'Password login only. SSO buttons hidden.' },
  {
    value: 'local_and_sso',
    label: 'Local + SSO',
    description: 'Both password and SSO login are available.',
  },
  {
    value: 'sso_only',
    label: 'SSO only',
    description: 'Hide local login (only enforced when SSO is actually active).',
  },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  help,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  type?: string;
}) => (
  <div className="space-y-1">
    <label className={labelClassName}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={inputClassName}
    />
    {help ? <div className={helpClassName}>{help}</div> : null}
  </div>
);

export default function SsoSettings() {
  const { showToast } = useToastContext();
  const { data: status, isLoading } = useSsoStatusQuery();
  const updateOpenId = useUpdateOpenIdMutation();
  const updateAuthMode = useUpdateAuthModeMutation();
  const validateOpenId = useValidateOpenIdMutation();

  const [fields, setFields] = useState<FieldState>(emptyFields);
  const [enabled, setEnabled] = useState(false);
  const [secretAction, setSecretAction] = useState<'keep' | 'replace' | 'clear'>('keep');
  const [clientSecret, setClientSecret] = useState('');
  const [validateResult, setValidateResult] = useState<SsoValidateResult | null>(null);

  useEffect(() => {
    if (!status) {
      return;
    }
    setEnabled(Boolean(status.enabled));
    setFields({
      issuer: status.issuer ?? '',
      clientId: status.clientId ?? '',
      scope: status.scope ?? '',
      callbackUrl: status.callbackUrl ?? '',
      buttonLabel: status.buttonLabel ?? '',
      imageUrl: status.imageUrl ?? '',
      emailClaim: status.emailClaim ?? '',
      usernameClaim: status.usernameClaim ?? '',
      nameClaim: status.nameClaim ?? '',
      requiredRole: status.requiredRole ?? '',
      adminRole: status.adminRole ?? '',
      allowedDomains: (status.allowedDomains ?? []).join(', '),
      autoRedirect: Boolean(status.autoRedirect),
    });
    setSecretAction('keep');
    setClientSecret('');
  }, [status]);

  const setField = (key: keyof FieldState, value: string | boolean) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (secretAction === 'replace' && !clientSecret.trim()) {
      showToast({ status: 'error', message: 'Enter the client secret or choose "Keep existing".' });
      return;
    }

    const payloadFields = {
      issuer: fields.issuer.trim(),
      clientId: fields.clientId.trim(),
      scope: fields.scope.trim(),
      callbackUrl: fields.callbackUrl.trim(),
      buttonLabel: fields.buttonLabel.trim(),
      imageUrl: fields.imageUrl.trim(),
      emailClaim: fields.emailClaim.trim(),
      usernameClaim: fields.usernameClaim.trim(),
      nameClaim: fields.nameClaim.trim(),
      requiredRole: fields.requiredRole.trim(),
      adminRole: fields.adminRole.trim(),
      allowedDomains: fields.allowedDomains
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
      autoRedirect: fields.autoRedirect,
    };

    updateOpenId.mutate(
      {
        enabled,
        fields: payloadFields,
        secretAction,
        clientSecret: clientSecret.trim() || undefined,
      },
      {
        onSuccess: () =>
          showToast({
            status: 'success',
            message: 'OpenID settings saved. Restart the server to apply login changes.',
          }),
        onError: (error) =>
          showToast({ status: 'error', message: getErrorMessage(error, 'Failed to save settings.') }),
      },
    );
  };

  const handleAuthMode = (mode: SsoAuthMode) =>
    updateAuthMode.mutate(mode, {
      onSuccess: () => showToast({ status: 'success', message: `Auth mode set to "${mode}".` }),
      onError: (error) =>
        showToast({ status: 'error', message: getErrorMessage(error, 'Failed to update auth mode.') }),
    });

  const handleValidate = () => {
    if (!fields.issuer.trim()) {
      showToast({ status: 'error', message: 'Enter an issuer URL first.' });
      return;
    }
    validateOpenId.mutate(fields.issuer.trim(), {
      onSuccess: (result) => {
        setValidateResult(result);
        showToast({
          status: result.ok ? 'success' : 'error',
          message: result.ok ? 'Discovery succeeded.' : `Discovery failed: ${result.error}`,
        });
      },
      onError: (error) =>
        showToast({ status: 'error', message: getErrorMessage(error, 'Validation failed.') }),
    });
  };

  const anyPending = updateOpenId.isLoading || updateAuthMode.isLoading;
  const currentMode = status?.authMode ?? 'local_and_sso';

  if (isLoading) {
    return (
      <div className={cardClassName}>
        <div className="text-sm text-text-secondary">Loading SSO settings…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className={`${cardClassName} space-y-2`}>
        <div className="text-lg font-semibold">Status</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-border-light bg-surface-secondary px-3 py-1 text-text-primary">
            Source: {status?.source ?? 'none'}
          </span>
          <span className="rounded-full border border-border-light bg-surface-secondary px-3 py-1 text-text-primary">
            OpenID: {status?.enabled ? 'enabled' : 'disabled'}
          </span>
          <span className="rounded-full border border-border-light bg-surface-secondary px-3 py-1 text-text-primary">
            Secret: {status?.secretStored ? 'stored' : 'not set'}
          </span>
          <span className="rounded-full border border-border-light bg-surface-secondary px-3 py-1 text-text-primary">
            Auth mode: {currentMode}
          </span>
        </div>
        {status?.error ? (
          <div className="text-sm text-red-500">Configuration error: {status.error}</div>
        ) : null}
        <div className={helpClassName}>
          Changes to OpenID settings take effect after a server restart.
        </div>
      </div>

      {/* Auth mode */}
      <div className={`${cardClassName} space-y-3`}>
        <div className="text-lg font-semibold">Login mode</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {authModeOptions.map((option) => {
            const active = currentMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={anyPending}
                onClick={() => handleAuthMode(option.value)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-green-500 bg-surface-secondary'
                    : 'border-border-light bg-surface-secondary hover:border-text-secondary'
                }`}
              >
                <div className="text-sm font-medium text-text-primary">{option.label}</div>
                <div className={helpClassName}>{option.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* OpenID config */}
      <div className={`${cardClassName} space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">OpenID Connect</div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Issuer URL"
            value={fields.issuer}
            onChange={(value) => setField('issuer', value)}
            placeholder="https://your-tenant.idp.com/"
            help="The provider's base URL. Used for discovery."
          />
          <Field
            label="Client ID"
            value={fields.clientId}
            onChange={(value) => setField('clientId', value)}
          />
          <Field
            label="Scope"
            value={fields.scope}
            onChange={(value) => setField('scope', value)}
            placeholder="openid profile email"
          />
          <Field
            label="Callback path"
            value={fields.callbackUrl}
            onChange={(value) => setField('callbackUrl', value)}
            placeholder="/oauth/openid/callback"
            help="Must match the redirect URI registered with the IdP."
          />
          <Field
            label="Button label"
            value={fields.buttonLabel}
            onChange={(value) => setField('buttonLabel', value)}
            placeholder="Continue with SSO"
          />
          <Field
            label="Button image URL"
            value={fields.imageUrl}
            onChange={(value) => setField('imageUrl', value)}
          />
          <Field
            label="Email claim"
            value={fields.emailClaim}
            onChange={(value) => setField('emailClaim', value)}
            placeholder="email"
          />
          <Field
            label="Username claim"
            value={fields.usernameClaim}
            onChange={(value) => setField('usernameClaim', value)}
          />
          <Field
            label="Name claim"
            value={fields.nameClaim}
            onChange={(value) => setField('nameClaim', value)}
          />
          <Field
            label="Required role (optional)"
            value={fields.requiredRole}
            onChange={(value) => setField('requiredRole', value)}
          />
          <Field
            label="Admin role (optional)"
            value={fields.adminRole}
            onChange={(value) => setField('adminRole', value)}
          />
          <Field
            label="Allowed domains (optional)"
            value={fields.allowedDomains}
            onChange={(value) => setField('allowedDomains', value)}
            placeholder="school.edu, district.org"
            help="Comma-separated. Restricts which email domains may sign in via SSO."
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={fields.autoRedirect}
            onChange={(event) => setField('autoRedirect', event.target.checked)}
          />
          Automatically redirect to the SSO provider on the login page
        </label>

        {/* Secret */}
        <div className="space-y-2 rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className={labelClassName}>Client secret</div>
          <div className="flex flex-wrap gap-2">
            {(['keep', 'replace', 'clear'] as const).map((action) => {
              const disabled = action === 'keep' && !status?.secretStored;
              return (
                <button
                  key={action}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSecretAction(action)}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                    secretAction === action
                      ? 'border-green-500 text-text-primary'
                      : 'border-border-light text-text-secondary hover:text-text-primary'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {action === 'keep'
                    ? status?.secretStored
                      ? 'Keep existing'
                      : 'Keep (none stored)'
                    : action}
                </button>
              );
            })}
          </div>
          {secretAction === 'replace' ? (
            <input
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder="Paste new client secret"
              className={inputClassName}
              autoComplete="new-password"
            />
          ) : null}
          <div className={helpClassName}>
            The secret is encrypted at rest and never shown again after saving.
          </div>
        </div>

        {validateResult ? (
          <div
            className={`rounded-xl border p-3 text-sm ${
              validateResult.ok
                ? 'border-green-500 text-text-primary'
                : 'border-red-400 text-red-500'
            }`}
          >
            {validateResult.ok
              ? `Discovery OK — issuer: ${validateResult.issuer}`
              : `Discovery failed: ${validateResult.error}${
                  validateResult.missing ? ` (missing: ${validateResult.missing.join(', ')})` : ''
                }`}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={validateOpenId.isLoading}
            onClick={handleValidate}
          >
            {validateOpenId.isLoading ? 'Testing…' : 'Test discovery'}
          </Button>
          <Button type="button" variant="submit" disabled={anyPending} onClick={handleSave}>
            {updateOpenId.isLoading ? 'Saving…' : 'Save OpenID settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
