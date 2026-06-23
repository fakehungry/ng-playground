import { Component, EventEmitter, input, Output, signal } from '@angular/core';
import { Asset, Platform, Well } from '../../../core/models/well-integrity.models';

@Component({
  selector: 'app-well-tree',
  standalone: true,
  templateUrl: './well-tree.html',
})
export class WellTree {
  assets          = input.required<Asset[]>();
  platforms       = input.required<Platform[]>();
  wells           = input.required<Well[]>();
  selectedWellIds = input.required<Set<string>>();

  @Output() selectionChange = new EventEmitter<Set<string>>();

  protected readonly expandedAssets    = signal<Set<string>>(new Set());
  protected readonly expandedPlatforms = signal<Set<string>>(new Set());

  protected platformsFor(assetId: string): Platform[] {
    return this.platforms().filter(p => p.assetId === assetId);
  }

  protected wellsFor(platformId: string): Well[] {
    return this.wells().filter(w => w.platformId === platformId);
  }

  protected isAssetExpanded(assetId: string): boolean {
    return this.expandedAssets().has(assetId);
  }

  protected isPlatformExpanded(platformId: string): boolean {
    return this.expandedPlatforms().has(platformId);
  }

  protected isWellSelected(wellId: string): boolean {
    return this.selectedWellIds().has(wellId);
  }

  protected hasAnySelectedInAsset(assetId: string): boolean {
    const sel = this.selectedWellIds();
    return this.wells().some(w => w.assetId === assetId && sel.has(w.id));
  }

  protected hasAnySelectedInPlatform(platformId: string): boolean {
    const sel = this.selectedWellIds();
    return this.wells().some(w => w.platformId === platformId && sel.has(w.id));
  }

  handleAssetClick(assetId: string, event: MouseEvent): void {
    event.preventDefault();
    const additive = event.ctrlKey || event.metaKey;
    this.toggleExpand('asset', assetId);
    const wellIds = this.wells().filter(w => w.assetId === assetId).map(w => w.id);
    this.updateSelection(wellIds, additive);
  }

  handlePlatformClick(assetId: string, platformId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const additive = event.ctrlKey || event.metaKey;
    if (!this.isAssetExpanded(assetId)) {
      this.expandedAssets.update(s => new Set([...s, assetId]));
    }
    this.toggleExpand('platform', platformId);
    const wellIds = this.wells().filter(w => w.platformId === platformId).map(w => w.id);
    this.updateSelection(wellIds, additive);
  }

  handleWellClick(wellId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const additive = event.ctrlKey || event.metaKey;
    this.updateSelection([wellId], additive);
  }

  private toggleExpand(type: 'asset' | 'platform', id: string): void {
    if (type === 'asset') {
      this.expandedAssets.update(s => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      this.expandedPlatforms.update(s => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  }

  private updateSelection(wellIds: string[], additive: boolean): void {
    const current = this.selectedWellIds();
    let next: Set<string>;

    if (additive) {
      next = new Set(current);
      const allAlreadySelected = wellIds.every(id => current.has(id));
      if (allAlreadySelected) {
        wellIds.forEach(id => next.delete(id));
      } else {
        wellIds.forEach(id => next.add(id));
      }
    } else {
      next = new Set(wellIds);
    }

    this.selectionChange.emit(next);
  }
}
