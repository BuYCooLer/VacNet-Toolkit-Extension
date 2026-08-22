export class DomObserver {
  private readonly roots = new Set<Node>();
  private observer: MutationObserver | null = null;
  private frameId: number | null = null;

  constructor(private readonly onChange: (root: Node) => void) {}

  start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => this.roots.add(node));
        } else {
          this.roots.add(mutation.target);
        }
      }
      this.schedule();
    });
    this.observer.observe(document, {
      attributeFilter: ['aria-label', 'title'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.roots.clear();
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private schedule(): void {
    if (this.frameId !== null) return;
    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      const roots = Array.from(this.roots);
      this.roots.clear();
      const topLevelRoots = roots.filter((root) =>
        !roots.some((candidate) => candidate !== root && candidate instanceof Node && candidate.contains(root)),
      );
      for (const root of topLevelRoots) {
        if (root.isConnected) this.onChange(root);
      }
    });
  }
}
