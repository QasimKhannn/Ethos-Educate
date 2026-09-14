import { useLocalize } from '~/hooks';

const GeneratedImageNotice = () => {
  const localize = useLocalize();

  return (
    <span role="note" className="mt-2 block max-w-lg text-xs leading-5 text-text-secondary">
      {localize('com_ui_ai_generated_image_notice')}
      <span className="block">{localize('com_ui_generated_image_retention_notice')}</span>
    </span>
  );
};

export default GeneratedImageNotice;
