import { Lifecycle, type ResponseMetadata } from './client';

export function compareRevisions(left: string, right: string): number {
  return left.length === right.length
    ? left === right
      ? 0
      : left > right
        ? 1
        : -1
    : left.length - right.length;
}

// One coordinator belongs to one private session, never to a module singleton.
export class Freshness {
  private watermark?: string;
  private observations = new Map<string, string>();
  private pending = new Set<string>();
  private scheduledAt = new Map<string, string>();
  private scheduled = false;
  private readonly generation: number;
  constructor(
    private lifecycle: Lifecycle,
    private onStale: (keys: readonly string[]) => void,
  ) {
    this.generation = lifecycle.generation;
    lifecycle.signal.addEventListener(
      'abort',
      () => {
        this.observations.clear();
        this.pending.clear();
        this.scheduledAt.clear();
      },
      { once: true },
    );
  }
  ownMutation(metadata: ResponseMetadata) {
    this.lifecycle.assert(this.generation);
    this.lifecycle.assert(metadata.generation);
    const revision = metadata.workspaceRevision;
    if (revision && (!this.watermark || compareRevisions(revision, this.watermark) > 0))
      this.watermark = revision;
  }
  observe(key: string, metadata: ResponseMetadata): boolean {
    this.lifecycle.assert(this.generation);
    this.lifecycle.assert(metadata.generation);
    const revision = metadata.workspaceRevision;
    if (!revision) return true;
    const previous = this.observations.get(key);
    if (previous && compareRevisions(revision, previous) < 0) return false;
    this.observations.set(key, revision);
    if (!this.watermark) this.watermark = revision;
    else if (compareRevisions(revision, this.watermark) > 0) {
      this.watermark = revision;
      for (const [other, stamp] of this.observations)
        if (other !== key && compareRevisions(stamp, revision) < 0) this.pending.add(other);
    }
    const stale = compareRevisions(revision, this.watermark) < 0;
    if (stale && this.scheduledAt.get(key) !== this.watermark) {
      this.pending.add(key);
      this.scheduledAt.set(key, this.watermark);
    }
    if (this.pending.size && !this.scheduled) {
      this.scheduled = true;
      // Allow the read/mutation promise to publish before invalidating dependent queries.
      setTimeout(() => {
        this.scheduled = false;
        if (this.lifecycle.generation !== this.generation) return;
        const keys = [...this.pending];
        this.pending.clear();
        if (keys.length) this.onStale(keys);
      }, 0);
    }
    return !stale;
  }
}
