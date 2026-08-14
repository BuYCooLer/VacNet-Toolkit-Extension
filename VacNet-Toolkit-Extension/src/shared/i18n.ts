import { browser } from 'wxt/browser';

export const messageKeys = [
  'extensionName', 'extensionDescription', 'cs2VideoReview', 'inviteReviewers', 'noInvites', 'clipsLabeled', 'logout',
  'watchClipInstructions', 'xrayActive', 'verdictTrainingNotice', 'uncertainNotice', 'clipSelectionNotice',
  'questionAimAssist', 'questionWallHack', 'questionAutoBhop', 'questionBot', 'labelAimAssist', 'labelWallHack',
  'labelAutoBhop', 'labelBot', 'btnYes', 'btnUncertain', 'btnNo', 'btnProceed', 'btnBack', 'btnConfirm',
  'statusSubmitting', 'statusPleaseWait', 'btnSendFeedback', 'btnReportBadClip', 'clipDetails', 'taskId', 'app',
  'none', 'devMetricsTitle', 'emptyClientSnapshot', 'notFound', 'clipDataTitle', 'webmUrl',
  'videoJsRuntime', 'playerId', 'version', 'language', 'debug', 'enabled', 'disabled', 'byAuthor', 'closeDashboard',
  'closeClipDetails', 'reviewInstructions', 'verdictTitle', 'verdict', 'btnSubmit', 'btnSkip', 'statusLoadingNextClip',
  'errorNextClipMissing', 'errorPlayerOrFormUnavailable', 'errorServerResponse', 'errorNextClipLoad', 'videoJsPlay',
  'videoJsPause', 'videoJsMute', 'videoJsUnmute', 'videoJsFullscreen', 'videoJsExitFullscreen', 'videoJsClose',
  'videoJsVideoPlayer', 'videoJsProgressBar', 'videoJsVolumeLevel', 'videoJsPlaybackRate', 'videoJsCaptions',
  'videoJsSubtitles', 'videoJsReset', 'videoJsDone', 'sourceCs2VideoReview', 'sourceInviteReviewers', 'sourceNoInvites',
  'sourceClipsLabeled', 'sourceLogout', 'sourceWatchClipInstructions', 'sourceXrayActive', 'sourceVerdictTrainingNotice',
  'sourceUncertainNotice', 'sourceClipSelectionNotice', 'sourceQuestionAimAssist', 'sourceQuestionWallHack',
  'sourceQuestionAutoBhop', 'sourceQuestionBot', 'sourceLabelAimAssist', 'sourceLabelWallHack', 'sourceLabelAutoBhop',
  'sourceLabelBot', 'sourceBtnUncertain', 'sourceBtnProceed', 'sourceBtnBack', 'sourceBtnConfirm', 'sourceStatusSubmitting',
  'sourceStatusPleaseWait', 'sourceBtnSendFeedback', 'sourceBtnReportBadClip', 'sourceClipDetails', 'sourceTaskId',
  'sourceApp', 'sourceMatchId', 'sourceNone', 'sourceDevMetricsTitle', 'stretchVideo', 'clipLogTitle', 'clipLogSummary',
  'totalClipsViewed', 'savedInLocalHistory', 'clipRepeats', 'recentClips', 'noClipHistory', 'badClip', 'clipIdentityStatus',
  'clipStatusNewVideo', 'clipStatusSameVideoDifferentClip', 'clipStatusExactDuplicate', 'videoId', 'clipRange', 'eventTime',
  'clipCountAtSubmission', 'clipKey', 'savedClips', 'hotkeyHelp',
  'clipSummaryVideo', 'clipSummaryMoment', 'clipSummaryRange', 'clipSummaryNew', 'clipSummaryRepeat', 'clipSummaryChecking',
  'savedVideos', 'historyTasks', 'historyVideo', 'historyClip', 'historyClipCount', 'openVideo', 'clipNumber', 'processedAt', 'technicalData', 'playerCount', 'frameDuration', 'previousVerdicts', 'autoApplyRepeatVerdicts', 'autoApplyRepeatVerdictsHint', 'clearVideoHistory', 'clearVideoHistoryHint', 'copyMetrics', 'copyMetricsHint',
] as const;

export type MessageKey = (typeof messageKeys)[number];

export type MessageCatalog = Record<MessageKey, string> & { videoJsLocale: 'ru' | 'en' };

export const getMessage = (key: MessageKey, substitutions?: string | string[]): string =>
  browser.i18n.getMessage(key as Parameters<typeof browser.i18n.getMessage>[0], substitutions) || key;

export const createCatalog = (): MessageCatalog => {
  const catalog = Object.fromEntries(messageKeys.map((key) => [key, getMessage(key)])) as Record<MessageKey, string>;
  return {
    ...catalog,
    videoJsLocale: browser.i18n.getUILanguage().toLowerCase().startsWith('ru') ? 'ru' : 'en',
  };
};
