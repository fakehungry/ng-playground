import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { WellIntegrityReport } from '../models/well-integrity.models';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly platformId = inject(PLATFORM_ID);

  exportReportCsv(report: WellIntegrityReport): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const headers = [
      'Asset',
      'Platform',
      'Well',
      'Annulus',
      'TOC (m)',
      'MESP (barg)',
      'MASP (barg)',
      'MOP (barg)',
      'TOW (m)',
      'MOP vs MASP',
      'MESP vs MASP',
      'Status',
    ];
    const rows: string[][] = [headers];

    for (const result of report.annulusResults) {
      rows.push([
        report.asset.name,
        report.platform.name,
        report.well.name,
        `${result.annulusType}-Annulus`,
        result.data?.toc?.toString() ?? '',
        report.mesp?.toString() ?? '',
        result.data?.masp?.toString() ?? '',
        result.data?.mop?.toString() ?? '',
        result.data?.tow?.toString() ?? '',
        result.mopVsMaspStatus.toUpperCase(),
        result.mespVsMaspStatus.toUpperCase(),
        result.overallStatus.toUpperCase(),
      ]);
    }

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `well-integrity-${report.well.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
