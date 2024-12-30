export class Future<T> {
  private resolved = false;
  private resolveFn: ((value: T) => void) | undefined = undefined;
  private rejectFn: ((error: Error) => void) | undefined = undefined;
  public promise: Promise<T>;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveFn = (value: T) => {
        this.resolved = true;
        resolve(value);
      };
      this.rejectFn = (error: Error) => {
        this.resolved = true;
        reject(error);
      };
    });
  }

  get resolve() {
    if (!this.resolveFn) {
      throw new Error("Future not initialized");
    }
    return this.resolveFn;
  }

  get reject() {
    if (!this.rejectFn) {
      throw new Error("Future not initialized");
    }
    return this.rejectFn;
  }

  get isResolved() {
    return this.resolved;
  }
}
