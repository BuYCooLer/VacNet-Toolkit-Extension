import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeExtensionUi } from '../../src/app/extension-ui';
import './style.css';

export default defineContentScript({
  matches: ['https://www.counter-strike.net/vacnet/clips*'],
  world: 'ISOLATED',
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  main: initializeExtensionUi,
});
