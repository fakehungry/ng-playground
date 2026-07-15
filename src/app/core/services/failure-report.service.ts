import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { FailureReport } from '../models/well-integrity.models';

@Injectable({ providedIn: 'root' })
export class FailureReportService {
  private readonly http = inject(HttpClient);

  private readonly _reports = signal<FailureReport[]>([]);
  readonly reports = this._reports.asReadonly();

  loadByWell(wellId: string): void {
    this.http
      .get<FailureReport[]>(`/api/failureReports?wellId=${wellId}`)
      .subscribe(data => this._reports.set(data));
  }

  clear(): void {
    this._reports.set([]);
  }

  save(data: FailureReport) {
    const existing = this._reports().find(r => r.id === data.id);
    const request = existing
      ? this.http.put<FailureReport>(`/api/failureReports/${data.id}`, data)
      : this.http.post<FailureReport>('/api/failureReports', data);
    return request.pipe(tap(() => this.loadByWell(data.wellId)));
  }
}
