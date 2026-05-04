import type { OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { useI18n } from '../../i18n.js';
import { getActionLabels, getWorkflowStatusLabels } from '../../workflowUi.js';
import { formatTimestamp } from './WorkflowShared.js';

type WorkflowHistorySectionProps = {
  session: OrchestrationSession | null;
};

export function WorkflowHistorySection({ session }: WorkflowHistorySectionProps) {
  const { locale, t } = useI18n();
  const actionLabels = getActionLabels(locale);
  const workflowStatusLabels = getWorkflowStatusLabels(locale);
  const eventLogEntries = session?.eventLog.slice().reverse() ?? [];

  return (
    <PageSection id="session-history" eyebrow={t.history.eyebrow} title={t.history.title}>
      <section className="panel">
        <ul className="history-list" aria-label={t.history.listAria}>
          {eventLogEntries.length ? eventLogEntries.map((entry, index) => (
            <li key={`${entry.timestamp}-${entry.step}-${index}`}>
              <div className="history-meta">
                <strong>{actionLabels[entry.step] ?? entry.step}</strong>
                <span>{workflowStatusLabels[entry.status]}</span>
              </div>
              <p>{entry.message}</p>
              <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp, locale, t.common.notAvailable)}</time>
            </li>
          )) : <li>{t.common.noEventsYet}</li>}
        </ul>
      </section>
    </PageSection>
  );
}