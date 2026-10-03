import { Injectable } from '@nestjs/common';

/** Keep dependencies alive until handlers finish, including after client aborts. */
@Injectable()
export class RequestWorkService {
  private readonly pending = new Set<Promise<void>>();

  begin(): () => void {
    let resolve!: () => void;
    const work = new Promise<void>((done) => {
      resolve = done;
    });
    this.pending.add(work);
    return () => {
      this.pending.delete(work);
      resolve();
    };
  }

  async drain(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
}
