type AsyncMutation<T> = () => Promise<T>;

export class StorageMutationCoordinator {
  private queue: Promise<unknown> = Promise.resolve();

  enqueue<T>(mutation: AsyncMutation<T>): Promise<T> {
    const operation = this.queue.then(mutation);
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
