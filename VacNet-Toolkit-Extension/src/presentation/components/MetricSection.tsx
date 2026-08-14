import type { ComponentChildren } from 'preact';

export interface MetricEntry {
  label: string;
  value: ComponentChildren;
  href?: string | null;
}

interface Props {
  title: string;
  entries: readonly MetricEntry[];
}

export const MetricSection = ({ title, entries }: Props) => (
  <section class="metric-section">
    <h3>{title}</h3>
    <dl>
      {entries.map((entry) => (
        <div class="metric" key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.href ? <a href={entry.href} target="_blank" rel="noreferrer">{entry.value}</a> : entry.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
