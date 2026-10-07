import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DEFAULT_INTEGRITY_CONFIG } from '../constants/integrity-defaults';
import { IntegrityConfig } from '../models/well-integrity.models';

const URL = '/api/integrityConfigs';

/** Merges a stored config over the defaults so configs saved before a field existed still work. */
function withDefaults(c: IntegrityConfig): IntegrityConfig {
  const d = DEFAULT_INTEGRITY_CONFIG;
  return {
    ...d,
    ...c,
    leakTest: { ...d.leakTest, ...c.leakTest },
    annulusPressure: { ...d.annulusPressure, ...c.annulusPressure },
    mesp: { ...d.mesp, ...c.mesp },
    barrier: { ...d.barrier, ...c.barrier },
    rules: {
      ...d.rules,
      ...c.rules,
      xtValve: { ...d.rules.xtValve, ...c.rules?.xtValve },
      annulusValve: { ...d.rules.annulusValve, ...c.rules?.annulusValve },
      dhsv: { ...d.rules.dhsv, ...c.rules?.dhsv },
    },
  };
}

@Injectable({ providedIn: 'root' })
export class IntegrityConfigService {
  private readonly http = inject(HttpClient);

  private readonly _config = signal<IntegrityConfig>(DEFAULT_INTEGRITY_CONFIG);
  readonly config = this._config.asReadonly();

  private readonly _persisted = signal(false);
  /** True once a config exists on the server (false = still running on built-in defaults). */
  readonly persisted = this._persisted.asReadonly();

  constructor() {
    this.loadConfig();
  }

  loadConfig(): void {
    this.http.get<IntegrityConfig[]>(URL).subscribe({
      next: (list) => {
        const stored = list[0];
        this._persisted.set(!!stored);
        this._config.set(stored ? withDefaults(stored) : DEFAULT_INTEGRITY_CONFIG);
      },
      error: () => this._config.set(DEFAULT_INTEGRITY_CONFIG),
    });
  }

  save(value: Omit<IntegrityConfig, 'id' | 'updatedAt'>): Observable<IntegrityConfig> {
    const body: IntegrityConfig = {
      ...value,
      id: this._persisted() ? this._config().id : 'default',
      updatedAt: new Date().toISOString(),
    };
    const req = this._persisted()
      ? this.http.put<IntegrityConfig>(`${URL}/${body.id}`, body)
      : this.http.post<IntegrityConfig>(URL, body);
    return req.pipe(
      tap((saved) => {
        this._persisted.set(true);
        this._config.set(withDefaults(saved));
      }),
    );
  }
}
