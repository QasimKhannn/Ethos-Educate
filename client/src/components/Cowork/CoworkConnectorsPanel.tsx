// cowork — global Connectors modal (opened from the left rail). Connect your tools once per
// teacher; a connected tool is available to the coworker in all your projects (Agent mode).
// API-key connectors take a credential form; OAuth ones are login-based (wired later); platform
// connectors (YouTube) are always on.
import { useState } from 'react';
import { Plug, Check, Loader2, Trash2, X, Info, Mail } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import type { TCoworkConnector } from 'librechat-data-provider';
import {
  useCoworkConnectorsQuery,
  useSaveCoworkConnectorCredentialsMutation,
  useDeleteCoworkConnectorCredentialsMutation,
} from '~/data-provider';
import { useMCPServerManager } from '~/hooks/MCP/useMCPServerManager';

export default function CoworkConnectorsModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToastContext();
  const { data: connectors = [], isLoading } = useCoworkConnectorsQuery();
  const saveCreds = useSaveCoworkConnectorCredentialsMutation();
  const deleteCreds = useDeleteCoworkConnectorCredentialsMutation();
  const mcp = useMCPServerManager();

  // OAuth connectors reflect LibreChat's live MCP connection status (shared with the main chat);
  // api-key/platform connectors use the cowork API's connected flag.
  const connectedOf = (c: TCoworkConnector) =>
    c.auth === 'oauth' && c.mcpServer
      ? mcp.connectionStatus?.[c.mcpServer]?.connectionState === 'connected'
      : c.connected;

  const [formFor, setFormFor] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [helpFor, setHelpFor] = useState<string | null>(null);

  const submitForm = (c: TCoworkConnector) => {
    setBusyId(c.id);
    saveCreds.mutate(
      { connectorId: c.id, fields: values },
      {
        onSuccess: (res) => {
          setFormFor(null);
          setValues({});
          showToast({
            message: res?.connected ? `${c.label} connected.` : 'Saved, but some fields are missing.',
            status: res?.connected ? 'success' : 'warning',
          });
        },
        onError: () => showToast({ message: `Could not connect ${c.label}.`, status: 'error' }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const disconnect = (c: TCoworkConnector) => {
    setBusyId(c.id);
    deleteCreds.mutate(c.id, {
      onSuccess: () => showToast({ message: `${c.label} disconnected.`, status: 'success' }),
      onError: () => showToast({ message: `Could not disconnect ${c.label}.`, status: 'error' }),
      onSettled: () => setBusyId(null),
    });
  };

  const disconnectBtn = (onClick: () => void, busy?: boolean) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-border-medium px-2 py-1 text-[11px] text-text-secondary hover:text-red-500 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      Disconnect
    </button>
  );

  const connectBtn = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-text-info px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
    >
      Connect
    </button>
  );

  const action = (c: TCoworkConnector) => {
    if (c.auth === 'platform') {
      return <span className="text-[11px] text-text-tertiary">Always on</span>;
    }

    // OAuth connectors reuse LibreChat's MCP connect flow (popup + polling).
    if (c.auth === 'oauth') {
      const server = c.mcpServer;
      if (!server) {
        return <span className="text-[11px] text-text-tertiary">Login coming soon</span>;
      }
      if (mcp.isInitializing(server)) {
        return (
          <button
            type="button"
            onClick={() => mcp.cancelOAuthFlow(server)}
            className="flex items-center gap-1 rounded-md border border-border-medium px-2 py-1 text-[11px] text-text-secondary hover:text-red-500"
          >
            <Loader2 className="size-3 animate-spin" /> Cancel
          </button>
        );
      }
      return connectedOf(c)
        ? disconnectBtn(() => mcp.revokeOAuthForServer(server))
        : connectBtn(() => mcp.initializeServer(server));
    }

    // api-key connectors use the cowork credential store.
    return c.connected
      ? disconnectBtn(() => disconnect(c), busyId === c.id)
      : connectBtn(() => {
          setFormFor(c.id);
          setValues({});
        });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-200 animate-in fade-in-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-xl duration-200 animate-in fade-in-0 zoom-in-95">
        <div className="flex flex-none items-center justify-between border-b border-border-medium px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Plug className="size-4 text-text-info" /> Connectors
            </p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Connect once — available to the coworker in all your projects (Agent mode).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mb-2 flex items-start gap-2 rounded-md border border-border-medium bg-surface-secondary/40 px-3 py-2 text-xs text-text-secondary">
            <Mail className="mt-0.5 size-3.5 flex-none text-text-info" />
            <span>
              Sending email? No connector needed — just ask the coworker in chat and it&apos;ll draft a
              ready-to-send message and open it in Gmail.
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {connectors.map((c) => (
                <li key={c.id} className="rounded-lg border border-border-medium px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{c.label}</span>
                        {connectedOf(c) && (
                          <span className="flex items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                            <Check className="size-2.5" /> Connected
                          </span>
                        )}
                        {c.help && (
                          <button
                            type="button"
                            title="How to connect"
                            onClick={() => setHelpFor(helpFor === c.id ? null : c.id)}
                            className={`flex-none rounded p-0.5 hover:text-text-info ${
                              helpFor === c.id ? 'text-text-info' : 'text-text-tertiary'
                            }`}
                          >
                            <Info className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-tertiary">{c.description}</p>
                    </div>
                    <div className="flex-none pt-0.5">{action(c)}</div>
                  </div>

                  {c.help && helpFor === c.id && (
                    <div className="mt-2 rounded-md bg-surface-secondary/50 p-2.5 text-xs text-text-secondary">
                      <p className="font-medium text-text-primary">How to connect {c.label}</p>
                      <p className="mt-1">{c.help.summary}</p>
                      <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                        {c.help.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {c.help.url && (
                        <a
                          href={c.help.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block font-medium text-text-info hover:underline"
                        >
                          Open the official guide →
                        </a>
                      )}
                    </div>
                  )}

                  {c.auth === 'apikey' && formFor === c.id && (
                    <div className="mt-2 flex flex-col gap-2 rounded-md bg-surface-secondary/50 p-2">
                      {(c.credentialFields ?? []).map((f) => (
                        <input
                          key={f.key}
                          type={f.secret ? 'password' : 'text'}
                          placeholder={f.placeholder || f.label}
                          value={values[f.key] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          className="rounded-md border border-border-medium bg-surface-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:outline-none focus:ring-0"
                        />
                      ))}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormFor(null);
                            setValues({});
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => submitForm(c)}
                          className="flex items-center gap-1 rounded-md bg-text-info px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busyId === c.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
