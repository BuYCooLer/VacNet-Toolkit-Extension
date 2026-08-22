import type { MessageCatalog, MessageKey } from '../../shared/i18n';

const translatedKeys: ReadonlyArray<readonly [MessageKey, MessageKey]> = [
  ['cs2VideoReview', 'sourceCs2VideoReview'],
  ['inviteReviewers', 'sourceInviteReviewers'],
  ['noInvites', 'sourceNoInvites'],
  ['clipsLabeled', 'sourceClipsLabeled'],
  ['logout', 'sourceLogout'],
  ['watchClipInstructions', 'sourceWatchClipInstructions'],
  ['xrayActive', 'sourceXrayActive'],
  ['verdictTrainingNotice', 'sourceVerdictTrainingNotice'],
  ['uncertainNotice', 'sourceUncertainNotice'],
  ['clipSelectionNotice', 'sourceClipSelectionNotice'],
  ['questionAimAssist', 'sourceQuestionAimAssist'],
  ['questionWallHack', 'sourceQuestionWallHack'],
  ['questionAutoBhop', 'sourceQuestionAutoBhop'],
  ['questionBot', 'sourceQuestionBot'],
  ['labelAimAssist', 'sourceLabelAimAssist'],
  ['labelWallHack', 'sourceLabelWallHack'],
  ['labelAutoBhop', 'sourceLabelAutoBhop'],
  ['labelBot', 'sourceLabelBot'],
  ['btnUncertain', 'sourceBtnUncertain'],
  ['btnProceed', 'sourceBtnProceed'],
  ['btnBack', 'sourceBtnBack'],
  ['btnConfirm', 'sourceBtnConfirm'],
  ['statusSubmitting', 'sourceStatusSubmitting'],
  ['statusPleaseWait', 'sourceStatusPleaseWait'],
  ['btnSendFeedback', 'sourceBtnSendFeedback'],
  ['btnReportBadClip', 'sourceBtnReportBadClip'],
  ['clipDetails', 'sourceClipDetails'],
  ['taskId', 'sourceTaskId'],
  ['app', 'sourceApp'],
  ['none', 'sourceNone'],
  ['devMetricsTitle', 'sourceDevMetricsTitle'],
];

export const createTranslations = (catalog: MessageCatalog): ReadonlyMap<string, string> => {
  const translations = new Map<string, string>();
  for (const [targetKey, sourceKey] of translatedKeys) {
    const source = catalog[sourceKey];
    const target = catalog[targetKey];
    if (source === target) continue;
    const existing = translations.get(source);
    if (existing && existing !== target) {
      throw new Error(`Conflicting translation mappings for source text: ${source}`);
    }
    translations.set(source, target);
  }
  return translations;
};
