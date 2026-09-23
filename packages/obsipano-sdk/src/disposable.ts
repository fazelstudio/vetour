/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  disposable.ts
 *  Standalone disposal primitives with no host dependency.
 *-----------------------------------------------------------------------------------------------*/

/**
Represents a type which can release resources, such as event listeners.
Extensions must dispose registrations when they are unloaded.
*/
export class Disposable {
  private disposable: { dispose(): void } | undefined;

  constructor(callOnDispose: () => void) {
    this.disposable = { dispose: callOnDispose };
  }

  dispose(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = undefined;
    }
  }

  /**
  Combine many disposables into one teardown handle.
  Disposal errors never break the remaining teardowns.
  */
  static from(...disposables: { dispose(): unknown }[]): Disposable {
    return new Disposable(() => {
      for (const item of disposables) {
        try {
          item.dispose();
        } catch (error) {
          console.error('Disposable teardown failed', error);
        }
      }
    });
  }
}

/**
An event subscription interface.
Subscribe with the returned function and release it through the disposer.
*/
export interface Event<T> {
  (listener: (event: T) => void): Disposable;
}

/**
Minimal in-process event emitter for SDK-side fan-out.
The host wires its own lifecycle into these shapes through the adapter.
*/
export class Emitter<T> {
  private listeners = new Set<(event: T) => void>();

  readonly event: Event<T> = (listener: (event: T) => void): Disposable => {
    this.listeners.add(listener);
    return new Disposable(() => {
      this.listeners.delete(listener);
    });
  };

  fire(event: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener failed', error);
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
