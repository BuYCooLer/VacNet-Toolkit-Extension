import { defineContentScript } from 'wxt/utils/define-content-script';
import { PageController } from '../src/page/page-controller';
import { parseToPageMessage, toPageEvent } from '../src/shared/protocol';

export default defineContentScript({
  matches: ['https://www.counter-strike.net/vacnet/clips*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if (window.__vacnetV2Controller) return;
    window.__vacnetV2Controller = true;
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    let hasAjaxClipTransition = false;
    document.addEventListener('vacnet:v2:clip-transition', () => {
      hasAjaxClipTransition = true;
    });
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...parameters: unknown[]): number => {
      if (timeout === 100 && typeof handler === 'function') {
        const source = Function.prototype.toString.call(handler);
        if (source.includes('startTime') && source.includes('endTime') && source.includes('currentTime')) return -1;
      }
      return nativeSetInterval(handler, timeout, ...parameters);
    }) as typeof window.setInterval;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...parameters: unknown[]): number => {
      if (hasAjaxClipTransition && timeout === 500 && typeof handler === 'function') {
        const source = Function.prototype.toString.call(handler);
        // Valve's original loadeddata listener survives source replacement and seeks to its closed-over startTime.
        if (source.includes('startTime') && source.includes('currentTime')) return -1;
      }
      return nativeSetTimeout(handler, timeout, ...parameters);
    }) as typeof window.setTimeout;
    const controller = new PageController();
    document.addEventListener(toPageEvent, (event) => {
      const message = parseToPageMessage(event.detail);
      if (message) controller.receive(message);
    });
    controller.start();
  },
});
