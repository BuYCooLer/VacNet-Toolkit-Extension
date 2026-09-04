import { effect } from '@preact/signals';
import { render } from 'preact';
import { createShadowRootUi, type ContentScriptContext } from 'wxt/client';
import { DomLocalizer } from '../features/site-translator/dom-localizer';
import { HeaderNameMasker } from '../features/valve-interop/header-name-masker';
import { dashboardStore } from '../features/dashboard/dashboard-store';
import { createMetricsReport } from '../features/dashboard/create-metrics-report';
import { clearHistory, findHistory, historySignal, importHistory, initializeHistoryStore, recordRepeat, saveHistoryEntry } from '../features/history/history-store';
import { initializePreferencesStore, preferencesSignal, updatePreferences } from '../features/preferences/preferences-store';
import { resetSnapshot, snapshotSignal } from '../features/video-player/player-store';
import { installPlayerHotkeys } from '../features/video-player/install-player-hotkeys';
import { createClipIdentity } from '../entities/clip';
import type { ClipHistoryEntry } from '../entities/history';
import { createCatalog } from '../shared/i18n';
import { createIsolatedMessageBus } from '../shared/message-bus';
import { sendMessage } from '../shared/extension-messaging';
import { TranslationProvider } from '../shared/use-translation';
import type { HistorySaveParams } from '../shared/protocol';
import { App } from './App';
import { createMessageHandler } from './message-handler';

const VIDEO_SELECTOR = '[data-vacnet-review-video], #video_html5_api, video.vjs-tech';

const createHistoryEntry = (
  params: HistorySaveParams,
  deduplication: ClipHistoryEntry['deduplication'],
): ClipHistoryEntry => ({
  ...params.verdicts,
  ...params.clip,
  clipKey: createClipIdentity(params.clip).clipKey,
  identityVersion: 2,
  deduplication,
  timestamp: Date.now(),
  badClip: params.badClip,
});

const reportError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  snapshotSignal.value = { ...snapshotSignal.value, error: message };
  console.error('[VACNET]', error);
};

const waitForDocument = (ctx: ContentScriptContext): Promise<void> => {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    ctx.addEventListener(document, 'DOMContentLoaded', () => resolve(), { once: true });
  });
};

export const initializeExtensionUi = async (ctx: ContentScriptContext): Promise<void> => {
  const catalog = createCatalog();
  const localizer = new DomLocalizer(catalog);
  const nameMasker = new HeaderNameMasker();
  const bus = createIsolatedMessageBus();
  let unsubscribeEvents: (() => void) | null = null;
  let stopHistoryFind: (() => void) | null = null;
  let stopHistorySave: (() => void) | null = null;
  let stopWebmMetadataRead: (() => void) | null = null;
  let unwatchPreferences: (() => void) | null = null;
  let unwatchHistory: (() => void) | null = null;
  let disposePreferencesBridge: (() => void) | null = null;
  let removeUi: (() => void) | null = null;
  let isDisposed = false;
  const getBody = (): HTMLBodyElement | null => document.querySelector('body');
  const isActive = (): boolean => !isDisposed;

  const dispose = (): void => {
    if (isDisposed) return;
    isDisposed = true;
    nameMasker.stop();
    disposePreferencesBridge?.();
    unsubscribeEvents?.();
    stopHistoryFind?.();
    stopHistorySave?.();
    stopWebmMetadataRead?.();
    unwatchPreferences?.();
    unwatchHistory?.();
    bus.dispose();
    localizer.stop();
    removeUi?.();
    dashboardStore.close();
    resetSnapshot();
    getBody()?.classList.remove('dashboard-open', 'vacnet-extension-root', 'vacnet-hide-nickname');
  };
  ctx.onInvalidated(dispose);

  const messageHandler = createMessageHandler(catalog, bus);
  unsubscribeEvents = bus.subscribe((event) => {
    void messageHandler.handle(event).catch(reportError);
  });
  stopHistoryFind = bus.handleHistoryFind(async ({ clip }) => {
    const lookup = await findHistory(clip);
    if (lookup.entry) await recordRepeat();
    return lookup;
  });
  stopHistorySave = bus.handleHistorySave(async (params) => {
    const lookup = await findHistory(params.clip);
    await saveHistoryEntry(createHistoryEntry(params, lookup.status));
  });
  stopWebmMetadataRead = bus.handleWebmMetadataRead(async ({ url }) =>
    sendMessage('readWebmMetadata', url));
  installPlayerHotkeys({
    context: ctx,
    isDashboardOpen: () => dashboardStore.value !== null,
    closeDashboard: () => {
      dashboardStore.close();
      void updatePreferences({ dashboardOpen: false }).catch(reportError);
    },
    getSnapshot: () => snapshotSignal.value,
    getPreferences: () => preferencesSignal.value,
    emitReviewCommand: (command) => bus.emit({ type: 'review-command', command }),
    emitPlayerCommand: (command) => bus.emit({ type: 'player-command', command }),
  });

  try {
    unwatchPreferences = await initializePreferencesStore(reportError);
    if (!isActive()) return;
    unwatchHistory = await initializeHistoryStore(reportError);
    if (!isActive()) return;

    if (preferencesSignal.value.dashboardOpen) dashboardStore.open('metrics');
    else dashboardStore.close();
    messageHandler.markHydrated();
    await waitForDocument(ctx);
    const body = getBody();
    if (!isActive() || !body) return;

    body.classList.add('vacnet-extension-root');
    localizer.start();
    nameMasker.start();

    let currentShadowHost: HTMLElement | null = null;

    /*
     * Mirror the theme preferences onto the shadow host and the page body.
     * Called from two places on purpose: onMount (the host may appear after
     * the effect below has already run its first pass, since autoMount waits
     * for the .verdict-column anchor) and the preferences effect. Without the
     * onMount call a slow-loading page renders the panel with default styling
     * until the user happens to change a setting.
     */
    const applyTheme = (host: HTMLElement | null): void => {
      const prefs = preferencesSignal.peek();
      const theme = prefs.theme || 'green';
      const themeMode = prefs.themeMode || 'dark';
      if (host) {
        host.setAttribute('data-theme', theme);
        host.setAttribute('data-mode', themeMode);
      }
      const target = getBody();
      if (!target) return;
      target.setAttribute('data-vacnet-theme', theme);
      target.setAttribute('data-vacnet-mode', themeMode);
      target.classList.toggle('vacnet-hide-nickname', Boolean(prefs.hideNickname));
    };

    const ui = await createShadowRootUi<HTMLDivElement>(ctx, {
      name: 'vacnet-extension-ui',
      position: 'inline',
      anchor: '.verdict-column',
      append: 'last',
      mode: 'open',
      isolateEvents: ['click', 'pointerdown', 'pointerup'],
      onMount(container, _shadow, shadowHost) {
        currentShadowHost = shadowHost;
        shadowHost.style.setProperty('display', 'contents', 'important');
        applyTheme(shadowHost);
        const root = document.createElement('div');
        root.style.setProperty('display', 'contents', 'important');
        container.append(root);
        render(
          <TranslationProvider catalog={catalog}>
            <App
              footerTarget={document.querySelector<HTMLElement>('.footer-buttons')}
              onReviewCommand={(command) => bus.emit({ type: 'review-command', command })}
              onClearHistory={() => {
                void clearHistory().catch(reportError);
              }}
              onCopyMetrics={() => {
                const video = document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
                const report = createMetricsReport({
                  pageUrl: window.location.href,
                  preferences: preferencesSignal.value,
                  snapshot: snapshotSignal.value,
                  video,
                });
                void navigator.clipboard.writeText(report).catch(reportError);
              }}
              onError={reportError}
              onImportHistory={(data) => { void importHistory(data).catch(reportError); }}
              onExportHistory={() => {
                const data = JSON.stringify(historySignal.value, null, 2);
                const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `vacnet-history-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            />
          </TranslationProvider>,
          root,
        );
        return root;
      },
      onRemove(root) {
        if (root) render(null, root);
      },
    });
    removeUi = () => ui.remove();
    if (!isActive()) {
      ui.remove();
      return;
    }

    ui.autoMount();
    messageHandler.sendInitialization();
    disposePreferencesBridge = effect(() => {
      const prefs = preferencesSignal.value;
      applyTheme(currentShadowHost);
      if (!isDisposed) bus.emit({ type: 'preferences', preferences: prefs });
    });
  } catch (error) {
    dispose();
    throw error;
  }
};
