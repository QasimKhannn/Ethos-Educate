import { ArrowRight, Briefcase } from 'lucide-react';

import { useLocalize } from '~/hooks';

const openProjectCreator = () => {
  window.dispatchEvent(new CustomEvent('cowork-new-project'));
};

export default function CoworkHome() {
  const localize = useLocalize();

  return (
    <div className="cowork-refined-home">
      <section className="cowork-refined-empty" aria-labelledby="cowork-empty-title">
        <span className="cowork-refined-empty-icon" aria-hidden="true">
          <Briefcase />
        </span>
        <span className="cowork-refined-empty-eyebrow">{localize('com_cowork_home_eyebrow')}</span>
        <h1 id="cowork-empty-title">{localize('com_cowork_home_title')}</h1>
        <p>{localize('com_cowork_home_description')}</p>
        <button type="button" onClick={openProjectCreator}>
          <span>{localize('com_cowork_home_create_project')}</span>
          <ArrowRight aria-hidden="true" />
        </button>
        <small>{localize('com_cowork_home_hint')}</small>
      </section>
    </div>
  );
}
