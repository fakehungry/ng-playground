import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { findCmElement } from '../../../core/constants/cm-elements';
import { CmRecord, CmSection, IntegrityStatus } from '../../../core/models/well-integrity.models';
import { CmService } from '../../../core/services/cm.service';
import { WellService } from '../../../core/services/well.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';

const SECTION_LABEL: Record<CmSection, string> = {
  xtBody: 'XT',
  wellhead: 'Wellhead',
  dhsv: 'DHSV',
};

@Component({
  selector: 'app-cm-list',
  standalone: true,
  imports: [RouterLink, StatusBadge, DateFormatPipe],
  templateUrl: './cm-list.html',
})
export class CmList implements OnInit {
  protected readonly cmService = inject(CmService);
  protected readonly wellService = inject(WellService);

  protected readonly searchTerm = signal('');
  protected readonly sectionFilter = signal<CmSection | 'All'>('All');

  protected readonly sectionOptions: Array<CmSection | 'All'> = ['All', 'xtBody', 'wellhead', 'dhsv'];
  protected readonly sectionLabel = SECTION_LABEL;

  protected readonly filteredRecords = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const section = this.sectionFilter();
    return this.cmService
      .records()
      .filter((r) => section === 'All' || r.elements.some((e) => e.section === section))
      .filter((r) => {
        if (!term) return true;
        const well = this.wellService.findWell(r.wellId);
        if (well?.name.toLowerCase().includes(term)) return true;
        return r.elements.some((e) => {
          const label = findCmElement(e.elementKey)?.label ?? e.elementKey;
          return (
            label.toLowerCase().includes(term) || e.elementData.rootCause.toLowerCase().includes(term)
          );
        });
      });
  });

  ngOnInit(): void {
    this.cmService.loadAll();
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

  protected elementSummary(record: CmRecord): string {
    return record.elements.map((e) => findCmElement(e.elementKey)?.label ?? e.elementKey).join(', ');
  }

  protected sectionSummary(record: CmRecord): string {
    const unique = [...new Set(record.elements.map((e) => SECTION_LABEL[e.section]))];
    return unique.join(', ');
  }

  protected overallResult(record: CmRecord): IntegrityStatus {
    if (record.elements.length === 0) return 'no-data';
    const anyFail = record.elements.some(
      (e) => e.elementData.currentStatus === 'Fail' || e.elementData.currentStatus === 'Dirty',
    );
    return anyFail ? 'fail' : 'pass';
  }

  protected rootCauseSummary(record: CmRecord): string {
    return record.elements
      .map((e) => e.elementData.rootCause)
      .filter((rc) => rc.trim() !== '')
      .join(' | ');
  }
}
