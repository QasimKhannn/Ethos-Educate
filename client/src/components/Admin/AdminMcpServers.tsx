import { useRef, useState } from 'react';
import { ResourceType } from 'librechat-data-provider';
import { Button, Spinner, OGDialogTrigger } from '@librechat/client';
import { useMCPServerManager } from '~/hooks';
import { GenericGrantAccessDialog } from '~/components/Sharing';
import MCPServerDialog from '~/components/SidePanel/MCPBuilder/MCPServerDialog';

const cardClassName = 'rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm';
const helpClassName = 'text-xs text-text-secondary';

/**
 * Admin-console MCP management.
 *
 * Reuses existing, production components only — no shared component is modified:
 *  - server list + shapes from `useMCPServerManager`
 *  - create flow from the existing `MCPServerDialog`
 *  - per-user assignment from the existing `GenericGrantAccessDialog`
 *    (ResourceType.MCPSERVER), the same dialog Agents/Prompts use.
 *
 * The existing role-level MCP enable/disable (MCPAdminSettings) is untouched and
 * still governs whether users can use MCPs at all; this view governs which
 * specific servers are assigned to which users.
 */
export default function AdminMcpServers() {
  const { availableMCPServers, isLoading } = useMCPServerManager();
  const [showCreate, setShowCreate] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="space-y-6">
      <div className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">MCP Servers</div>
            <div className={helpClassName}>
              Create MCP servers and assign them to specific users. Role-level access is managed
              under Roles &amp; Permissions.
            </div>
          </div>
          <MCPServerDialog
            open={showCreate}
            onOpenChange={setShowCreate}
            triggerRef={createTriggerRef}
          >
            <OGDialogTrigger asChild>
              <Button
                ref={createTriggerRef}
                type="button"
                variant="submit"
                onClick={() => setShowCreate(true)}
              >
                Create MCP server
              </Button>
            </OGDialogTrigger>
          </MCPServerDialog>
        </div>
      </div>

      {isLoading ? (
        <div className={`${cardClassName} flex items-center gap-2`}>
          <Spinner className="h-4 w-4" />
          <span className="text-sm text-text-secondary">Loading MCP servers…</span>
        </div>
      ) : availableMCPServers.length > 0 ? (
        <div className="space-y-3">
          {availableMCPServers.map((server) => {
            const displayName = server.config?.title || server.serverName;
            return (
              <div
                key={server.serverName}
                className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-text-primary">
                    {displayName}
                  </div>
                  {server.config?.description ? (
                    <div className="truncate text-sm text-text-secondary">
                      {server.config.description}
                    </div>
                  ) : null}
                  {!server.dbId ? (
                    <div className={helpClassName}>
                      Config-based server — managed via configuration, not assignable per user.
                    </div>
                  ) : null}
                </div>

                {server.dbId ? (
                  <GenericGrantAccessDialog
                    resourceDbId={server.dbId}
                    resourceId={server.serverName}
                    resourceName={displayName}
                    resourceType={ResourceType.MCPSERVER}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cardClassName}>
          <div className="text-sm text-text-secondary">
            No MCP servers yet. Use “Create MCP server” to add one.
          </div>
        </div>
      )}
    </div>
  );
}
