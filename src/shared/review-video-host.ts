export interface ReviewVideoHost {
  element: HTMLDivElement;
  video: HTMLVideoElement;
}

export interface ReviewVideoHostPort {
  mount: () => ReviewVideoHost;
  dispose: () => void;
}
