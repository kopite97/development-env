import type { PrivateTransport } from '../../shared/http/transport';
import { Query } from '../../shared/http/query';
import { parseOverview, type Overview, type OverviewFilter } from './apiModel';
export class OverviewStore {
  private queries = new Map<string, Query<Overview>>();
  constructor(private transport: PrivateTransport) {
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  query(filter: OverviewFilter) {
    const key = JSON.stringify([filter.scope, filter.projectId ?? null]);
    let query = this.queries.get(key);
    if (!query) {
      const params = new URLSearchParams({ scope: filter.scope });
      if (filter.projectId) params.set('projectId', filter.projectId);
      query = new Query<Overview>((signal) =>
        this.transport.request('/api/v1/overview?' + params, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: (value) => parseOverview(value, filter),
        }),
      );
      this.queries.set(key, query);
    }
    return query;
  }
  invalidate() {
    for (const query of this.queries.values()) query.invalidate();
  }
  dispose() {
    for (const query of this.queries.values()) query.cancel();
    this.queries.clear();
  }
}
