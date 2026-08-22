import { verdictNames, type VerdictSelection } from '../../entities/verdict';

export interface ValveSubmitRequest {
  url: string;
  init: RequestInit;
}

const verdictLabel = (name: (typeof verdictNames)[number], value: VerdictSelection[typeof name]): string => {
  if (value === 'positive') return `guilty_${name}`;
  if (value === 'negative') return `innocent_${name}`;
  return `skip_${name}`;
};

export const createValveSubmitRequest = (
  verdicts: VerdictSelection,
  badClip: boolean,
  signal: AbortSignal,
): ValveSubmitRequest => {
  const form = document.querySelector<HTMLFormElement>('#submitverdictform');
  if (!form) throw new Error('Valve verdict form was not found.');
  if (!form.action) throw new Error('Valve verdict form has no action URL.');
  if (form.method.toUpperCase() !== 'POST') {
    throw new Error(`Unsupported Valve verdict form method: ${form.method || 'unknown'}.`);
  }

  const body = new FormData(form);
  body.delete('verdict_labels[]');
  if (badClip) body.append('verdict_labels[]', 'tag_badclip');
  else {
    for (const name of verdictNames) {
      body.append('verdict_labels[]', verdictLabel(name, verdicts[name]));
    }
  }

  return {
    url: form.action,
    init: {
      method: 'POST',
      body,
      credentials: 'same-origin',
      redirect: 'follow',
      signal,
    },
  };
};
