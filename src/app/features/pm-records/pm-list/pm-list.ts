import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PmService } from '../../../core/services/pm.service';
import { WellService } from '../../../core/services/well.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { PmStatus } from '../../../core/models/well-integrity.models';

@Component({
  selector: 'app-pm-list',
  standalone: true,
  imports: [RouterLink, StatusBadge, DateFormatPipe],
  templateUrl: './pm-list.html',
})
export class PmList implements OnInit {
  protected readonly pmService = inject(PmService);
  protected readonly wellService = inject(WellService);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<PmStatus | 'All'>('All');

  protected readonly statusOptions: Array<PmStatus | 'All'> = ['All', 'Planned', 'In Progress', 'Completed'];

  protected readonly filteredRecords = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    return this.pmService
      .records()
      .filter(r => status === 'All' || r.status === status)
      .filter(r => {
        const well = this.wellService.findWell(r.wellId);
        return !term || (well?.name.toLowerCase().includes(term) ?? false) || r.jobDescription.toLowerCase().includes(term);
      });
  });

  ngOnInit(): void {
    this.pmService.loadAll();
  }

  protected wellName(wellId: string): string {
    return this.wellService.findWell(wellId)?.name ?? wellId;
  }

  protected platformName(wellId: string): string {
    const well = this.wellService.findWell(wellId);
    return well ? (this.wellService.findPlatform(well.platformId)?.name ?? '—') : '—';
  }

  protected assetName(wellId: string): string {
    const well = this.wellService.findWell(wellId);
    return well ? (this.wellService.findAsset(well.assetId)?.name ?? '—') : '—';
  }
}
