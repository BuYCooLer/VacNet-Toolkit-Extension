interface CompatibilityActions {
  onRefresh: () => void;
  onSubmit: (badClip: boolean) => void;
}

interface LegacyValveGlobals {
  setModeLabeling: (() => void) | undefined;
  setModeConfirmLabels: (() => void) | undefined;
  showLabelingButtons: (() => void) | undefined;
  submitLabels: (() => void) | undefined;
  reportBadClip: (() => void) | undefined;
}

const restoreGlobal = (
  name: 'SetModeLabeling' | 'SetModeConfirmLabels' | 'ShowLabelingButtons' | 'SubmitLabels' | 'ReportBadClip',
  installed: (() => void) | undefined,
  original: (() => void) | undefined,
): void => {
  if (window[name] !== installed) return;
  const value = original;
  if (value) {
    window[name] = value;
    return;
  }
  delete window[name];
};

export const installValveCompatibility = ({ onRefresh, onSubmit }: CompatibilityActions): (() => void) => {
  const legacy: LegacyValveGlobals = {
    setModeLabeling: window.SetModeLabeling,
    setModeConfirmLabels: window.SetModeConfirmLabels,
    showLabelingButtons: window.ShowLabelingButtons,
    submitLabels: window.SubmitLabels,
    reportBadClip: window.ReportBadClip,
  };

  const handleSubmit = (event: SubmitEvent): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'submitverdictform') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onSubmit(false);
  };

  const handleClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-action='report-bad-clip'], [onclick*='ReportBadClip']")
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onSubmit(true);
  };

  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('click', handleClick, true);
  window.SetModeLabeling = onRefresh;
  window.SetModeConfirmLabels = onRefresh;
  window.ShowLabelingButtons = onRefresh;
  window.SubmitLabels = () => onSubmit(false);
  window.ReportBadClip = () => onSubmit(true);
  const installedGlobals: LegacyValveGlobals = {
    setModeLabeling: window.SetModeLabeling,
    setModeConfirmLabels: window.SetModeConfirmLabels,
    showLabelingButtons: window.ShowLabelingButtons,
    submitLabels: window.SubmitLabels,
    reportBadClip: window.ReportBadClip,
  };

  return () => {
    document.removeEventListener('submit', handleSubmit, true);
    document.removeEventListener('click', handleClick, true);
    restoreGlobal('SetModeLabeling', installedGlobals.setModeLabeling, legacy.setModeLabeling);
    restoreGlobal('SetModeConfirmLabels', installedGlobals.setModeConfirmLabels, legacy.setModeConfirmLabels);
    restoreGlobal('ShowLabelingButtons', installedGlobals.showLabelingButtons, legacy.showLabelingButtons);
    restoreGlobal('SubmitLabels', installedGlobals.submitLabels, legacy.submitLabels);
    restoreGlobal('ReportBadClip', installedGlobals.reportBadClip, legacy.reportBadClip);
  };
};
