import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { RigSchedule } from '../models/well-integrity.models';

@Injectable({ providedIn: 'root' })
export class RigScheduleService {
  private readonly http = inject(HttpClient);

  private readonly _schedules = signal<RigSchedule[]>([]);
  readonly schedules = this._schedules.asReadonly();

  loadAll(): void {
    this.http.get<RigSchedule[]>('/api/rigSchedules').subscribe((s) => this._schedules.set(s));
  }
}
