import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/page/page-style.css';

export default defineContentScript({
  matches: ['https://www.counter-strike.net/vacnet/clips*'],
  runAt: 'document_start',
  main() {},
});
