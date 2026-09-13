import type { Clock } from "../application/ports";

export class SystemClock implements Clock {
  private offset = 0;

  now(): number {
    return Date.now() + this.offset;
  }

  observeServerTime(serverTime: number): void {
    this.offset = serverTime - Date.now();
  }
}
