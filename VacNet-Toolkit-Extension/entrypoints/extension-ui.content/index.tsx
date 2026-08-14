import { render } from 'preact';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { StorageRepository } from '../../src/core/storage-repository';
import { emptyHistory } from '../../src/domain/history';
import { DomLocalizer } from '../../src/core/dom-localizer';
import { createCatalog } from '../../src/shared/i18n';
import { dispatchToPage, fromPageEvent, parseFromPageMessage } from '../../src/shared/protocol';
import { App } from '../../src/presentation/App';
import { dashboardModeSignal, historySignal, preferencesSignal, readySignal, snapshotSignal } from '../../src/presentation/state';
import type { Preferences } from '../../src/domain/preferences';
import { createClipIdentity } from '../../src/domain/clip';
import './style.css';

export default defineContentScript({
  matches: ['https://www.counter-strike.net/vacnet/clips*'],
  world: 'ISOLATED',
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const repository = new StorageRepository();
    const catalog = createCatalog();
    const localizer = new DomLocalizer(catalog);
    const initial = await repository.load();
    preferencesSignal.value = initial.preferences;
    historySignal.value = initial.history;

    const updatePreferences = async (patch: Partial<Preferences>): Promise<void> => {
      const preferences = { ...preferencesSignal.value, ...patch };
      preferencesSignal.value = preferences;
      await repository.savePreferences(preferences);
      dispatchToPage({ type: 'preferences', preferences });
    };

    ctx.addEventListener(document, fromPageEvent, (event) => {
      const message = parseFromPageMessage(event.detail);
      if (!message) return;
      if (message.type === 'ready') {
        readySignal.value = true;
        dispatchToPage({ type: 'initialize', catalog, preferences: preferencesSignal.value });
      } else if (message.type === 'snapshot') {
        snapshotSignal.value = message.snapshot;
      } else if (message.type === 'clip-updated') {
        snapshotSignal.value = { ...snapshotSignal.value, clip: message.clip };
        dispatchToPage({ type: 'command', command: 'request-state' });
      } else if (message.type === 'player-metrics') {
        snapshotSignal.value = { ...snapshotSignal.value, player: message.metrics };
      } else if (message.type === 'preferences') {
        void updatePreferences(message.preferences);
      } else if (message.type === 'history-find') {
        let history = historySignal.value;
        const lookup = repository.find(history, message.clip);
        if (lookup.entry) {
          history = repository.recordRepeat(history);
          historySignal.value = history;
          void repository.saveHistory(history);
        }
        dispatchToPage({ type: 'history-result', requestId: message.requestId, lookup });
      } else {
        const entry = {
          ...message.verdicts,
          ...message.clip,
          ...createClipIdentity(message.clip),
          identityVersion: 2 as const,
          deduplication: message.deduplication,
          timestamp: Date.now(),
          badClip: message.badClip,
        };
        const history = repository.saveEntry(historySignal.value, entry);
        historySignal.value = history;
        void repository.saveHistory(history);
        dispatchToPage({ type: 'history-result', requestId: message.requestId, lookup: null });
      }
    });

    const mount = async (): Promise<void> => {
      const ui = await createShadowRootUi<HTMLDivElement>(ctx, {
        name: 'vacnet-extension-ui',
        position: 'inline',
        anchor: '.verdict-column',
        append: 'last',
        mode: 'open',
        isolateEvents: ['keydown', 'keyup', 'keypress', 'click', 'pointerdown', 'pointerup'],
        onMount(container, _shadow, shadowHost) {
          shadowHost.style.setProperty('display', 'contents', 'important');
          const root = document.createElement('div');
          root.style.setProperty('display', 'contents', 'important');
          container.append(root);
          const clearHistory = (): void => {
            const history = emptyHistory();
            historySignal.value = history;
            void repository.saveHistory(history);
          };
          const copyMetrics = (): void => {
            const current = snapshotSignal.value;
            const report = {
              generatedAt: new Date().toISOString(),
              pageUrl: location.href,
              snapshot: current,
              video: document.querySelector<HTMLVideoElement>('#video_html5_api, video.vjs-tech') ? {
                currentTime: document.querySelector<HTMLVideoElement>('#video_html5_api, video.vjs-tech')?.currentTime ?? null,
                duration: document.querySelector<HTMLVideoElement>('#video_html5_api, video.vjs-tech')?.duration ?? null,
                readyState: document.querySelector<HTMLVideoElement>('#video_html5_api, video.vjs-tech')?.readyState ?? null,
                networkState: document.querySelector<HTMLVideoElement>('#video_html5_api, video.vjs-tech')?.networkState ?? null,
              } : null,
              preferences: preferencesSignal.value,
            };
            void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
          };
          render(<App catalog={catalog} onPreferences={(preferences) => { void updatePreferences(preferences); }} onClearHistory={clearHistory} onCopyMetrics={copyMetrics} />, root);
          return root;
        },
        onRemove(root) {
          if (root) render(null, root);
        },
      });
      ui.mount();
      ctx.onInvalidated(() => ui.remove());
    };

    const initialize = (): void => {
      document.body.classList.add('vacnet-extension-root');
      localizer.start();
      void mount();
      dispatchToPage({ type: 'initialize', catalog, preferences: preferencesSignal.value });
      dashboardModeSignal.value = null;
    };

    if (document.readyState === 'loading') ctx.addEventListener(document, 'DOMContentLoaded', initialize, { once: true });
    else initialize();
    ctx.onInvalidated(() => localizer.stop());
  },
});
