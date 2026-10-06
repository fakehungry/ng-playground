import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { Asset, FlowMechanism, Platform, Well } from '../models/well-integrity.models';

@Injectable({ providedIn: 'root' })
export class WellService {
  private readonly http = inject(HttpClient);

  readonly assets = toSignal(this.http.get<Asset[]>('/api/assets'), { initialValue: [] });
  readonly platforms = toSignal(this.http.get<Platform[]>('/api/platforms'), { initialValue: [] });
  private readonly _wells = signal<Well[]>([]);
  readonly wells = this._wells.asReadonly();

  constructor() {
    this.http.get<Well[]>('/api/wells').subscribe(wells => this._wells.set(wells));
  }

  readonly selectedAssetId = signal<string | null>(null);
  readonly selectedPlatformId = signal<string | null>(null);
  readonly selectedWellId = signal<string | null>(null);

  readonly filteredPlatforms = computed(() =>
    this.platforms().filter(p => p.assetId === this.selectedAssetId()),
  );

  readonly filteredWells = computed(() =>
    this.wells().filter(w => w.platformId === this.selectedPlatformId()),
  );

  selectAsset(id: string | null): void {
    this.selectedAssetId.set(id);
    this.selectedPlatformId.set(null);
    this.selectedWellId.set(null);
  }

  selectPlatform(id: string | null): void {
    this.selectedPlatformId.set(id);
    this.selectedWellId.set(null);
  }

  selectWell(id: string | null): void {
    this.selectedWellId.set(id);
  }

  updateFlowMechanism(wellId: string, flowMechanism: FlowMechanism) {
    return this.http.patch<Well>(`/api/wells/${wellId}`, { flowMechanism }).pipe(
      tap(updated => this._wells.update(ws => ws.map(w => (w.id === wellId ? updated : w)))),
    );
  }

  findWell(id: string): Well | undefined {
    return this.wells().find(w => w.id === id);
  }

  findPlatform(id: string): Platform | undefined {
    return this.platforms().find(p => p.id === id);
  }

  findAsset(id: string): Asset | undefined {
    return this.assets().find(a => a.id === id);
  }
}
