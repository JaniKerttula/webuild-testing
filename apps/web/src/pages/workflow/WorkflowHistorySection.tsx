import { workflowStatusLabels, type OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { actionLabels } from '../../workflowUi.js';
import { formatTimestamp } from './WorkflowShared.js';

type WorkflowHistorySectionProps = {
  session: OrchestrationSession | null;
};

export function WorkflowHistorySection({ session }: WorkflowHistorySectionProps) {
  const eventLogEntries = session?.eventLog.slice().reverse() ?? [];

  return (
    <PageSection id="session-history" eyebrow="History" title="Session event log">
      <section className="panel">
        <ul className="history-list" aria-label="Session event log">
          {eventLogEntries.length ? eventLogEntries.map((entry, index) => (
            <li key={`${entry.timestamp}-${entry.step}-${index}`}>
              <div className="history-meta">
                <strong>{actionLabels[entry.step] ?? entry.step}</strong>
                <span>{workflowStatusLabels[entry.status]}</span>
              </div>
              <p>{entry.message}</p>
              <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
            </li>
          )) : <li>No session events recorded yet.</li>}
        </ul>
      </section>
    </PageSection>
  );
}