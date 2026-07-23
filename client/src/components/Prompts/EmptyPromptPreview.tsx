import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useHasAccess, useLocalize } from '~/hooks';

export default function EmptyPromptPreview() {
  const localize = useLocalize();
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.CREATE,
  });

  return (
    <section className="prompts-empty-stage" aria-labelledby="prompts-empty-title">
      <div className="prompts-empty-card">
        <div className="prompts-empty-heading">
          <h2 id="prompts-empty-title">{localize('com_ui_no_prompts_title')}</h2>
          <p>{localize('com_ui_prompt_empty_description')}</p>
        </div>

        {hasCreateAccess && (
          <Button asChild className="prompts-empty-primary-action">
            <Link to="/d/prompts/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {localize('com_ui_create_prompt')}
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
