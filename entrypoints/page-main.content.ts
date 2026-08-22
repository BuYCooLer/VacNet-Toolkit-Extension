import { defineContentScript } from 'wxt/utils/define-content-script';
import { MainWorldRuntime } from '../src/app/main-world-runtime';
import { installValveTimerHijacker } from '../src/features/valve-interop/timer-hijacker';
import { createMainMessageBus } from '../src/shared/message-bus';
import 'plyr/dist/plyr.css';
import '../src/features/valve-interop/valve-overrides.css';

export default defineContentScript({
  matches: ['https://www.counter-strike.net/vacnet/clips*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if (window.__vacnetMainWorldRuntime) return;

    const bus = createMainMessageBus();
    const timerHijacker = installValveTimerHijacker();
    const runtime = new MainWorldRuntime(bus, timerHijacker);
    let isDisposed = false;

    const dispose = (): void => {
      if (isDisposed) return;
      isDisposed = true;
      runtime.dispose();
      timerHijacker.dispose();
      bus.dispose();
      window.removeEventListener('pagehide', onPageHide);
      delete window.__vacnetMainWorldRuntime;
    };
    const onPageHide = (event: PageTransitionEvent): void => {
      if (!event.persisted) dispose();
    };

    window.__vacnetMainWorldRuntime = { dispose };
    window.addEventListener('pagehide', onPageHide);
    try {
      runtime.start();
    } catch (error) {
      dispose();
      throw error;
    }
  },
});
