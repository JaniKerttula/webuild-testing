import { PageHero } from '../components/PageLayout.js';
import { useI18n } from '../i18n.js';

type SuccessPageProps = {
  onReturnToStart: () => void;
};

export function SuccessPage({ onReturnToStart }: SuccessPageProps) {
  const { t } = useI18n();

  return (
    <PageHero
      title={t.successPage.title}
      intro={t.successPage.description}
      actions={(
        <button type="button" className="action-button" onClick={onReturnToStart}>
          {t.successPage.returnToStart}
        </button>
      )}
    />
  );
}