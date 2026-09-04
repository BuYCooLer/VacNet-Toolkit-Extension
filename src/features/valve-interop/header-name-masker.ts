/**
 * HeaderNameMasker
 *
 * Implements interactive nickname masking for the reviewer's name in the Counter-Strike
 * VACNet portal header (.PageHeader .right p). The reviewer name is rendered as a bare
 * TextNode preceding the Logout anchor.
 *
 * This masks the name with a 7px Gaussian blur under a fixed-width container to prevent
 * leaking name length or glyph shapes. Hovering displays a progressive SVG ring indicator
 * that reveals the name after 1 second. Clicking toggles a persistent lock (padlock icon).
 */

const NAME_HOLD_MS = 1000;
const LS_NAMELOCK = 'vacnet_reviewer_name_locked';

const EYE_SVG =
  '<span class="vne-name-eye" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg></span>';

const LOCK_SVG =
  '<span class="vne-name-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>';

export class HeaderNameMasker {
  private isDisposed = false;
  private headObserver: MutationObserver | null = null;
  private bodyObserver: MutationObserver | null = null;
  private observedHead: Element | null = null;
  private retryTimer: number | null = null;
  private nameLocked = false;

  constructor() {
    try {
      this.nameLocked = localStorage.getItem(LS_NAMELOCK) === 'true';
    } catch {
      this.nameLocked = false;
    }
  }

  public start(): void {
    if (this.isDisposed) return;
    this.censorName();
    this.hookHeader();
  }

  public stop(): void {
    this.isDisposed = true;
    if (this.retryTimer !== null) {
      window.clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    this.headObserver?.disconnect();
    this.headObserver = null;
    this.bodyObserver?.disconnect();
    this.bodyObserver = null;
    this.observedHead = null;
  }

  private hookHeader(): void {
    const attachToHead = (): boolean => {
      const head = document.querySelector('.PageHeader');
      if (!head) return false;
      if (head === this.observedHead) return true;

      this.observedHead = head;
      this.headObserver?.disconnect();
      this.headObserver = new MutationObserver(() => {
        if (this.isDisposed) return;
        this.headObserver?.disconnect();
        try {
          this.censorName();
        } finally {
          if (this.observedHead && !this.isDisposed) {
            this.headObserver?.observe(this.observedHead, { childList: true, subtree: true });
          }
        }
      });
      this.headObserver.observe(head, { childList: true, subtree: true });
      this.censorName();
      return true;
    };

    if (!attachToHead()) {
      if (document.body) {
        this.bodyObserver = new MutationObserver(() => {
          if (attachToHead() && this.bodyObserver) {
            this.bodyObserver.disconnect();
            this.bodyObserver = null;
          }
        });
        this.bodyObserver.observe(document.body, { childList: true });
      }

      let retries = 0;
      this.retryTimer = window.setInterval(() => {
        retries += 1;
        if (attachToHead() || retries > 25 || this.isDisposed) {
          if (this.retryTimer !== null) {
            window.clearInterval(this.retryTimer);
            this.retryTimer = null;
          }
        }
      }, 200);
    }
  }

  public censorName(): void {
    if (this.isDisposed) return;

    const paragraphs = document.querySelectorAll<HTMLParagraphElement>('.PageHeader .right p, .PageHeader p');
    for (const p of paragraphs) {
      const hasLogout =
        p.querySelector('a[href*="logout" i]') ||
        Array.from(p.querySelectorAll('a')).some((a) => /(?:logout|выход)/i.test(a.textContent || ''));
      if (!hasLogout) continue;

      if (p.querySelector('.vne-name')) continue;

      for (const node of Array.from(p.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent?.trim();
        if (!text) continue;

        const span = document.createElement('span');
        span.className = 'vne-name' + (this.nameLocked ? ' vne-revealed vne-locked' : '');
        span.innerHTML =
          '<span class="vne-name-text"></span>' +
          EYE_SVG +
          '<svg class="vne-name-ring" viewBox="0 0 20 20" aria-hidden="true">' +
          '<circle class="vne-ring-bg" cx="10" cy="10" r="8"/>' +
          '<circle class="vne-ring-fg" cx="10" cy="10" r="8"/></svg>' +
          LOCK_SVG;

        const textSpan = span.querySelector<HTMLSpanElement>('.vne-name-text');
        if (textSpan) {
          textSpan.textContent = text;
        }

        let timer: number | null = null;
        const hold = (): void => {
          timer = window.setTimeout(() => {
            span.classList.add('vne-revealed');
          }, NAME_HOLD_MS);
        };

        span.addEventListener('mouseenter', () => {
          if (!this.nameLocked) hold();
        });

        span.addEventListener('mouseleave', () => {
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
          if (!this.nameLocked) span.classList.remove('vne-revealed');
        });

        span.addEventListener('click', (e) => {
          e.stopPropagation();
          this.nameLocked = !this.nameLocked;
          try {
            localStorage.setItem(LS_NAMELOCK, String(this.nameLocked));
          } catch {}

          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }

          const allSpans = document.querySelectorAll('.vne-name');
          for (const s of allSpans) {
            s.classList.toggle('vne-locked', this.nameLocked);
            s.classList.toggle('vne-revealed', this.nameLocked);
          }

          if (!this.nameLocked) hold();
        });

        p.replaceChild(span, node);
        if (node.textContent && /\s$/.test(node.textContent)) {
          p.insertBefore(document.createTextNode(' '), span.nextSibling);
        }
      }
    }
  }
}
