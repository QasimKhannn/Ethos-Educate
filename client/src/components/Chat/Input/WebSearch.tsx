import React, { memo } from 'react';
import { CheckboxButton } from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';
import ToolFeatureIcon from './ToolFeatureIcon';

function WebSearch() {
  const localize = useLocalize();
  const { webSearch: webSearchData, searchApiKeyForm } = useBadgeRowContext();
  const { toggleState: webSearch, debouncedChange, isPinned, authData } = webSearchData;
  const { badgeTriggerRef } = searchApiKeyForm;

  const canUseWebSearch = useHasAccess({
    permissionType: PermissionTypes.WEB_SEARCH,
    permission: Permissions.USE,
  });

  if (!canUseWebSearch) {
    return null;
  }

  return (
    (isPinned || (webSearch && authData?.authenticated)) && (
      <CheckboxButton
        ref={badgeTriggerRef}
        className="max-w-fit"
        checked={webSearch}
        setValue={debouncedChange}
        label={localize('com_ui_search')}
        isCheckedClassName="border-blue-600/40 bg-blue-500/10 hover:bg-blue-700/10"
        icon={<ToolFeatureIcon icon="websearch" className="icon-md" />}
      />
    )
  );
}

export default memo(WebSearch);
