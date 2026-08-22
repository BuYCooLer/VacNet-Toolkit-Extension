import type { ClipData } from '../../entities/clip';
import type { ParsedValvePage } from './clip-reader';

const VERDICT_FIELDS = new Set(['aimassist', 'wallhack', 'autobhop', 'bot', 'verdict_labels[]']);
const SYNCHRONIZED_SELECTORS = [
  '#detailsModalContent',
  '.perf_timing_area',
  '.modalgraph',
  '.evidencelog',
  '.accountdata',
  '.datasourcetable',
];

const sanitizeAttributes = (element: Element): void => {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim().toLowerCase();
    if (name.startsWith('on') || name === 'srcdoc' || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
      element.removeAttribute(attribute.name);
    }
  }
};

const sanitizeNode = (node: Node): Node => {
  const clone = node.cloneNode(true);
  if (clone instanceof Element) {
    sanitizeAttributes(clone);
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode() as Element | null;
    while (current) {
      sanitizeAttributes(current);
      current = walker.nextNode() as Element | null;
    }
  }
  return clone;
};

const validateForms = (nextDocument: Document): { currentForm: HTMLFormElement; nextForm: HTMLFormElement } => {
  const currentForm = document.querySelector<HTMLFormElement>('#submitverdictform');
  if (!currentForm) throw new Error('Current Valve verdict form was removed before the page transition.');
  const nextForm = nextDocument.querySelector<HTMLFormElement>('#submitverdictform');
  if (!nextForm) throw new Error('Next Valve page does not contain a verdict form.');
  if (!nextForm.action) throw new Error('Next Valve verdict form has no action URL.');
  return { currentForm, nextForm };
};

const synchronizeForm = (nextDocument: Document): void => {
  const { currentForm, nextForm } = validateForms(nextDocument);
  currentForm.action = nextForm.action;
  currentForm.method = nextForm.method;
  for (const input of Array.from(currentForm.querySelectorAll<HTMLInputElement>('input'))) {
    if (!VERDICT_FIELDS.has(input.name)) input.remove();
  }
  for (const input of Array.from(nextForm.querySelectorAll<HTMLInputElement>('input'))) {
    if (!VERDICT_FIELDS.has(input.name)) currentForm.append(input.cloneNode(true));
  }
};

const synchronizeFragments = (nextDocument: Document): void => {
  for (const selector of SYNCHRONIZED_SELECTORS) {
    const current = document.querySelector(selector);
    const next = nextDocument.querySelector(selector);
    if (!current) continue;
    if (!next) {
      current.replaceChildren();
      continue;
    }
     current.replaceChildren(...Array.from(next.childNodes).map(sanitizeNode));
  }
};

const synchronizeClipCount = (nextDocument: Document): void => {
  const nextCount = nextDocument.querySelector('.ClipCount')?.textContent.match(/\d+/u)?.[0];
  if (!nextCount) return;
  const currentCount = document.querySelector<HTMLElement>('.ClipCount');
  if (!currentCount) throw new Error('Current Valve page does not contain the clip counter.');
  const label = currentCount.textContent.trim();
  currentCount.textContent = /\d+/u.test(label) ? label.replace(/\d+/u, nextCount) : `${label} ${nextCount}`;
};

const storeCanonicalClip = (clip: ClipData): void => {
  const state = document.documentElement.dataset;
  state.vacnetClipTaskId = clip.taskId;
  state.vacnetClipVideoId = clip.videoId;
  state.vacnetClipSource = clip.sourceWebmUrl;
  state.vacnetClipStartTime = String(clip.range.start);
  state.vacnetClipEndTime = String(clip.range.end);
  state.vacnetClipEventTime = String(clip.eventTime);
};

const canonicalClipDatasetKeys = [
  'vacnetClipTaskId',
  'vacnetClipVideoId',
  'vacnetClipSource',
  'vacnetClipStartTime',
  'vacnetClipEndTime',
  'vacnetClipEventTime',
] as const;

const captureSnapshot = () => {
  const form = document.querySelector<HTMLFormElement>('#submitverdictform');
  if (!form) throw new Error('Current Valve verdict form was removed before the page transition.');
  return {
    form,
    action: form.action,
    method: form.method,
    verdictInputs: Array.from(form.querySelectorAll<HTMLInputElement>('input'))
      .filter((input) => VERDICT_FIELDS.has(input.name))
      .map((input) => input.cloneNode(true)),
    fragments: SYNCHRONIZED_SELECTORS.flatMap((selector) => {
      const element = document.querySelector(selector);
      return element ? [{ element, children: Array.from(element.childNodes).map((child) => child.cloneNode(true)) }] : [];
    }),
    clipCount: document.querySelector<HTMLElement>('.ClipCount'),
    clipCountText: document.querySelector<HTMLElement>('.ClipCount')?.textContent ?? null,
    dataset: document.documentElement.dataset,
    canonicalClipState: canonicalClipDatasetKeys.map((key) => [key, document.documentElement.dataset[key]] as const),
  };
};

const createCommitRollback = (): (() => void) => {
  const snapshot = captureSnapshot();
  return () => {
    snapshot.form.action = snapshot.action;
    snapshot.form.method = snapshot.method;
    for (const input of Array.from(snapshot.form.querySelectorAll<HTMLInputElement>('input'))) {
      if (VERDICT_FIELDS.has(input.name)) input.remove();
    }
    for (const input of snapshot.verdictInputs) snapshot.form.append(input.cloneNode(true));
    for (const fragment of snapshot.fragments) {
      fragment.element.replaceChildren(...fragment.children.map((child) => child.cloneNode(true)));
    }
    if (snapshot.clipCount && snapshot.clipCountText !== null) snapshot.clipCount.textContent = snapshot.clipCountText;
    for (const [key, value] of snapshot.canonicalClipState) {
      if (value === undefined) delete snapshot.dataset[key];
      else snapshot.dataset[key] = value;
    }
  };
};


export const commitValvePage = (page: ParsedValvePage): void => {
  const rollback = createCommitRollback();
  try {
    synchronizeForm(page.document);
    synchronizeFragments(page.document);
    synchronizeClipCount(page.document);
    storeCanonicalClip(page.clip);
  } catch (error) {
    rollback();
    throw error;
  }
};

export const validateValveCommit = (page: ParsedValvePage): void => {
  validateForms(page.document);
  if (page.clip.clipCount && !document.querySelector('.ClipCount')) {
    throw new Error('Current Valve page does not contain the clip counter required for transition.');
  }
};

export const storeInitialValveClip = (clip: ClipData): void => {
  storeCanonicalClip(clip);
};
