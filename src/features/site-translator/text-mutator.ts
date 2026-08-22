const ignoredSelector = 'script, style, textarea, input, vacnet-extension-ui';
const translatedAttributes = ['title', 'aria-label'] as const;

export class TextMutator {
  constructor(private readonly translations: ReadonlyMap<string, string>) {}

  get isActive(): boolean {
    return this.translations.size > 0;
  }

  translate(container: Node): void {
    if (container === document.documentElement) this.translateTitle();
    if (container.nodeType === Node.TEXT_NODE) {
      this.translateText(container);
      return;
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      this.translateText(node);
      node = walker.nextNode();
    }
    if (container instanceof Element) this.translateElementTree(container);
  }

  private translateTitle(): void {
    const translated = this.translations.get(document.title);
    if (translated) document.title = translated;
  }

  private translateText(node: Node): void {
    const parent = node.parentElement;
    if (!parent || parent.closest(ignoredSelector)) return;

    const value = node.nodeValue ?? '';
    const translated = this.translations.get(value.trim());
    if (!translated) return;
    const nextValue = `${value.match(/^\s*/u)?.[0] ?? ''}${translated}${value.match(/\s*$/u)?.[0] ?? ''}`;
    if (nextValue !== value) node.nodeValue = nextValue;
  }

  private translateElementTree(container: Element): void {
    this.translateAttributes(container);
    for (const element of container.querySelectorAll<HTMLElement>('[title], [aria-label]')) {
      this.translateAttributes(element);
    }
  }

  private translateAttributes(element: Element): void {
    for (const attribute of translatedAttributes) {
      const source = element.getAttribute(attribute);
      const translated = source ? this.translations.get(source) : undefined;
      if (translated && translated !== source) element.setAttribute(attribute, translated);
    }
  }
}
