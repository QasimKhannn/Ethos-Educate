import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToastContext } from '@librechat/client';
import { Check, Info, Loader2, Mail, Plug, Trash2, X } from 'lucide-react';
import type { TCoworkConnector } from 'librechat-data-provider';
import {
  useCoworkConnectorsQuery,
  useDeleteCoworkConnectorCredentialsMutation,
  useSaveCoworkConnectorCredentialsMutation,
} from '~/data-provider';
import { useMCPServerManager } from '~/hooks/MCP/useMCPServerManager';
import { useLocalize } from '~/hooks';

type CoworkConnectorsModalProps = {
  onClose: () => void;
};

type CredentialValues = {
  [key: string]: string;
};

type ConnectorGroups = {
  ready: TCoworkConnector[];
  available: TCoworkConnector[];
};

export default function CoworkConnectorsModal({ onClose }: CoworkConnectorsModalProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: connectors = [], isLoading } = useCoworkConnectorsQuery();
  const saveCreds = useSaveCoworkConnectorCredentialsMutation();
  const deleteCreds = useDeleteCoworkConnectorCredentialsMutation();
  const mcp = useMCPServerManager();
  const [formFor, setFormFor] = useState<string | null>(null);
  const [values, setValues] = useState<CredentialValues>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const connectedOf = useCallback(
    (connector: TCoworkConnector) =>
      connector.auth === 'oauth' && connector.mcpServer
        ? mcp.connectionStatus?.[connector.mcpServer]?.connectionState === 'connected'
        : connector.connected,
    [mcp.connectionStatus],
  );

  const connectorGroups = useMemo(
    () =>
      connectors.reduce<ConnectorGroups>(
        (groups, connector) =>
          connectedOf(connector)
            ? { ...groups, ready: [...groups.ready, connector] }
            : { ...groups, available: [...groups.available, connector] },
        { ready: [], available: [] },
      ),
    [connectors, connectedOf],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];

      if (!firstFocusableElement || !lastFocusableElement) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === titleRef.current ||
          document.activeElement === firstFocusableElement)
      ) {
        event.preventDefault();
        lastFocusableElement.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    titleRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submitForm = (connector: TCoworkConnector) => {
    setBusyId(connector.id);
    saveCreds.mutate(
      { connectorId: connector.id, fields: values },
      {
        onSuccess: (result) => {
          setFormFor(null);
          setValues({});
          showToast({
            message: result?.connected
              ? localize('com_cowork_connector_connected_toast', { label: connector.label })
              : localize('com_cowork_connector_fields_missing'),
            status: result?.connected ? 'success' : 'warning',
          });
        },
        onError: () =>
          showToast({
            message: localize('com_cowork_connector_connect_error', { label: connector.label }),
            status: 'error',
          }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const disconnect = (connector: TCoworkConnector) => {
    setBusyId(connector.id);
    deleteCreds.mutate(connector.id, {
      onSuccess: () =>
        showToast({
          message: localize('com_cowork_connector_disconnected_toast', { label: connector.label }),
          status: 'success',
        }),
      onError: () =>
        showToast({
          message: localize('com_cowork_connector_disconnect_error', { label: connector.label }),
          status: 'error',
        }),
      onSettled: () => setBusyId(null),
    });
  };

  const disconnectButton = (onClick: () => void, busy?: boolean) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex min-h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      {localize('com_cowork_disconnect')}
    </button>
  );

  const connectButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="min-h-8 rounded-md bg-[#2858b8] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#1f4695] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {localize('com_cowork_connect')}
    </button>
  );

  const connectorAction = (connector: TCoworkConnector) => {
    if (connector.auth === 'platform') {
      return (
        <span className="whitespace-nowrap text-xs font-medium text-slate-500">
          {localize('com_cowork_always_on')}
        </span>
      );
    }

    if (connector.auth === 'oauth') {
      const server = connector.mcpServer;
      if (!server) {
        return (
          <span className="whitespace-nowrap text-xs text-slate-500">
            {localize('com_cowork_login_coming_soon')}
          </span>
        );
      }
      if (mcp.isInitializing(server)) {
        return (
          <button
            type="button"
            onClick={() => mcp.cancelOAuthFlow(server)}
            className="flex min-h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Loader2 className="size-3 animate-spin" />
            {localize('com_cowork_cancel')}
          </button>
        );
      }
      return connectedOf(connector)
        ? disconnectButton(() => mcp.revokeOAuthForServer(server))
        : connectButton(() => mcp.initializeServer(server));
    }

    return connector.connected
      ? disconnectButton(() => disconnect(connector), busyId === connector.id)
      : connectButton(() => {
          setFormFor(connector.id);
          setValues({});
        });
  };

  const connectorItem = (connector: TCoworkConnector) => (
    <li key={connector.id} className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{connector.label}</span>
            {connectedOf(connector) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check className="size-3" aria-hidden="true" />
                {localize('com_cowork_connected')}
              </span>
            )}
            {connector.help && (
              <button
                type="button"
                title={localize('com_cowork_how_to_connect_label', { label: connector.label })}
                aria-label={localize('com_cowork_how_to_connect_label', { label: connector.label })}
                aria-expanded={helpFor === connector.id}
                onClick={() => setHelpFor(helpFor === connector.id ? null : connector.id)}
                className={[
                  'inline-flex size-6 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                  helpFor === connector.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
                ].join(' ')}
              >
                <Info className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">{connector.description}</p>
        </div>
        <div className="flex-none pt-0.5">{connectorAction(connector)}</div>
      </div>

      {connector.help && helpFor === connector.id && (
        <div className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600">
          <p className="font-semibold text-slate-900">
            {localize('com_cowork_how_to_connect_label', { label: connector.label })}
          </p>
          <p className="mt-1">{connector.help.summary}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {connector.help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {connector.help.url && (
            <a
              href={connector.help.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {localize('com_cowork_open_official_guide')}
            </a>
          )}
        </div>
      )}

      {connector.auth === 'apikey' && formFor === connector.id && (
        <form
          className="mt-3 grid gap-3 border-t border-slate-200 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitForm(connector);
          }}
        >
          {(connector.credentialFields ?? []).map((field) => {
            const inputId = connector.id + '-' + field.key;

            return (
              <label
                key={field.key}
                htmlFor={inputId}
                className="grid gap-1.5 text-xs font-medium text-slate-700"
              >
                {field.label}
                <input
                  id={inputId}
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.placeholder || field.label}
                  value={values[field.key] ?? ''}
                  onChange={(event) =>
                    setValues((currentValues) => ({
                      ...currentValues,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            );
          })}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormFor(null);
                setValues({});
              }}
              className="min-h-8 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {localize('com_cowork_cancel')}
            </button>
            <button
              type="submit"
              disabled={busyId === connector.id}
              className="flex min-h-8 items-center gap-1 rounded-md bg-[#2858b8] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#1f4695] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {busyId === connector.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              {localize('com_cowork_save')}
            </button>
          </div>
        </form>
      )}
    </li>
  );

  const connectorSection = (label: string, items: TCoworkConnector[]) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <section aria-label={label} className="space-y-2.5">
        <h3 className="px-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </h3>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {items.map(connectorItem)}
        </ul>
      </section>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 duration-150 animate-in fade-in-0 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cowork-connectors-title"
        aria-describedby="cowork-connectors-description"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:max-h-[min(44rem,calc(100dvh-3rem))]"
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              ref={titleRef}
              id="cowork-connectors-title"
              tabIndex={-1}
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900"
            >
              <Plug className="size-4 text-[#b9812e]" aria-hidden="true" />
              {localize('com_cowork_connectors')}
            </h2>
            <p id="cowork-connectors-description" className="mt-1 text-xs leading-5 text-slate-600">
              {localize('com_cowork_connectors_description')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={localize('com_cowork_close_connectors')}
            className="inline-flex size-8 flex-none items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
            <Mail className="mt-0.5 size-4 flex-none text-[#b9812e]" aria-hidden="true" />
            <p>{localize('com_cowork_connectors_email_note')}</p>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {localize('com_cowork_loading_connectors')}
            </div>
          ) : (
            <div className="space-y-5">
              {connectorSection(
                localize('com_cowork_connectors_ready_to_use'),
                connectorGroups.ready,
              )}
              {connectorSection(
                localize('com_cowork_connectors_available_to_connect'),
                connectorGroups.available,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
