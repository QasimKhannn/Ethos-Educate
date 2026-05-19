import { ShieldEllipsis } from 'lucide-react';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { Button, useToastContext } from '@librechat/client';
import { AdminSettingsDialog } from '~/components/ui';
import { useUpdateMarketplacePermissionsMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { PermissionConfig } from '~/components/ui';
import { cn } from '~/utils';

const permissions: PermissionConfig[] = [
  { permission: Permissions.USE, labelKey: 'com_ui_marketplace_allow_use' },
];

interface MarketplaceAdminSettingsProps {
  triggerClassName?: string;
  tourId?: string;
}

const MarketplaceAdminSettings = ({
  triggerClassName = '',
  tourId,
}: MarketplaceAdminSettingsProps) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const mutation = useUpdateMarketplacePermissionsMutation({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_saved') });
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_error_save_admin_settings') });
    },
  });

  const trigger = (
    <Button
      variant="outline"
      className={cn(
        'relative h-12 rounded-xl border-border-light bg-surface-primary px-3.5 font-medium text-text-secondary shadow-none hover:bg-surface-hover hover:text-text-primary',
        triggerClassName,
      )}
      aria-label={localize('com_ui_admin_settings')}
      data-control-panel-tour-id={tourId}
    >
      <ShieldEllipsis className="h-[18px] w-[18px] cursor-pointer" aria-hidden="true" />
    </Button>
  );

  return (
    <AdminSettingsDialog
      permissionType={PermissionTypes.MARKETPLACE}
      sectionKey="com_ui_marketplace"
      permissions={permissions}
      menuId="marketplace-role-dropdown"
      mutation={mutation}
      trigger={trigger}
      dialogContentClassName="w-11/12 max-w-md border-border-light bg-surface-primary text-text-primary"
      showAdminWarning={false}
    />
  );
};

export default MarketplaceAdminSettings;
