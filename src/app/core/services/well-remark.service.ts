import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WellRemark } from '../models/well-integrity.models';

@Injectable({ providedIn: 'root' })
export class WellRemarkService {
  private readonly http = inject(HttpClient);

  private readonly _remarks = signal<WellRemark[]>([]);
  readonly remarks = this._remarks.asReadonly();

  loadAll(): void {
    this.http.get<WellRemark[]>('/api/wellRemarks').subscribe(r => this._remarks.set(r));
  }

  upsert(wellId: string, data: { issue: string; action: string; remark: string }): Observable<WellRemark> {
    const existing = this._remarks().find(r => r.wellId === wellId);
    if (existing) {
      const body: WellRemark = { ...existing, ...data };
      return this.http.put<WellRemark>(`/api/wellRemarks/${existing.id}`, body).pipe(
        tap(() => this.loadAll()),
      );
    }
    const body: WellRemark = { id: crypto.randomUUID(), wellId, ...data };
    return this.http.post<WellRemark>('/api/wellRemarks', body).pipe(
      tap(() => this.loadAll()),
    );
  }
}
