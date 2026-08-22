import type { ComponentChildren } from 'preact';
import { getSafeExternalUrl } from '../external-url';
import styles from './MetricSection.module.css';

export interface MetricEntry {
  key?: string;
  label: string;
  value: ComponentChildren;
  href?: string | null;
}

interface MetricSectionProps {
  title: string;
  entries: readonly MetricEntry[];
}

export const MetricSection = ({ title, entries }: MetricSectionProps) => (
  <section class={styles.section}>
    <h3>{title}</h3>
    <dl>
      {entries.map((entry) => (
          <div class={styles.metric} key={entry.key ?? entry.label}>
          <dt>{entry.label}</dt>
          <dd>
             {getSafeExternalUrl(entry.href)
               ? <a href={getSafeExternalUrl(entry.href) ?? undefined} target="_blank" rel="noreferrer">{entry.value}</a>
              : entry.value}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);
