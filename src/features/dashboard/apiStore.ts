import { CancelledError, HttpError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import {
  parseDashboard,
  sameWidgets,
  saveBody,
  type ApiDashboard,
  type DashboardSave,
} from './apiModel';
export class DashboardStore {
  readonly home: Query<ApiDashboard>;
  private epoch = 0;
  private lifetime = new AbortController();
  private pending = false;
  private watermark = 0;
  onSaved = () => {};
  constructor(readonly transport: PrivateTransport) {
    this.home = new Query(async (signal) => {
      const epoch = this.epoch;
      const data = await transport.request('/api/v2/dashboards/home', {
        signal,
        generation: transport.generation,
        expectedStatus: 200,
        parse: parseDashboard,
      });
      this.assert(epoch);
      if (data.revision < this.watermark)
        throw new Error('이전 배치 응답입니다. 다시 확인해 주세요.');
      this.watermark = data.revision;
      return data;
    });
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  private assert(epoch = this.epoch) {
    this.transport.lifecycle.assert(this.transport.generation);
    if (this.lifetime.signal.aborted || epoch !== this.epoch) throw new CancelledError();
  }
  invalidate() {
    this.epoch++;
    this.home.invalidate();
  }
  async save(intent: DashboardSave) {
    this.assert();
    if (this.pending) throw new Error('배치를 저장 중입니다.');
    const body = saveBody(intent.revision, intent.widgets);
    this.pending = true;
    try {
      const result = await this.transport.request('/api/v2/dashboards/home', {
        method: 'PUT',
        json: body,
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: 200,
        parse: parseDashboard,
      });
      this.assert();
      if (
        result.revision <= body.revision ||
        result.revision < this.watermark ||
        !sameWidgets(result.widgets, body.widgets)
      )
        throw new HttpError(
          200,
          'PROTOCOL_ERROR',
          '저장 응답을 확인하지 못했습니다. 최신 배치를 확인해 주세요.',
        );
      this.watermark = Math.max(this.watermark, result.revision);
      this.invalidate();
      await this.home.load(async () => result);
      this.assert();
      this.onSaved();
      return result;
    } catch (error) {
      this.assert();
      this.invalidate();
      throw error;
    } finally {
      this.pending = false;
    }
  }
  dispose() {
    this.lifetime.abort();
    this.epoch++;
    this.home.cancel();
  }
}
