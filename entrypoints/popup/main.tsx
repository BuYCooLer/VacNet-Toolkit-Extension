import { render } from 'preact';
import { getMessage } from '../../src/shared/messages';
import { Popup } from './Popup';

/*
 * Last-resort screen for a popup that failed to render. Built with DOM calls
 * rather than innerHTML because the extension CSP forbids inline event
 * handlers: the previous onclick="location.reload()" attribute was silently
 * dropped, leaving a retry button that did nothing.
 */
const renderFallback = (root: HTMLElement): void => {
  let errorText = 'The interface failed to load.';
  let retryText = 'Retry';
  try {
    errorText = getMessage('popupRenderError');
    retryText = getMessage('popupRetry');
  } catch {
    /* Fall back to English if the catalog is the thing that broke. */
  }

  const box = document.createElement('div');
  box.style.cssText = 'padding:16px;background:#1b1e24;color:#f0f0f0;font-family:sans-serif;text-align:center;';

  const title = document.createElement('h3');
  title.textContent = 'VACNET Toolkit';
  title.style.cssText = 'margin:0 0 8px;color:#a7d46f;';

  const message = document.createElement('p');
  message.textContent = errorText;
  message.style.cssText = 'margin:0 0 12px;font-size:12px;color:#8f98a0;';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = retryText;
  retry.style.cssText = 'background:#5c862c;border:none;color:#fff;padding:8px 16px;border-radius:4px;cursor:pointer;';
  retry.addEventListener('click', () => location.reload());

  box.append(title, message, retry);
  root.replaceChildren(box);
};

const root = document.getElementById('root');
if (root) {
  try {
    render(<Popup />, root);
  } catch (error) {
    console.error('[VACNET Popup] Render failed:', error);
    renderFallback(root);
  }
}
