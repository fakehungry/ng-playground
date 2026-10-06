import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { ParsedPm, PmExcelService } from '../../../core/services/pm-excel.service';

@Component({
  selector: 'app-pm-import',
  standalone: true,
  templateUrl: './pm-import.html',
})
export class PmImport {
  private readonly excel = inject(PmExcelService);

  /** Emits the chosen record so the parent form can fill itself in. */
  readonly fill = output<ParsedPm>();

  protected readonly rows = signal<ParsedPm[]>([]);
  protected readonly fileName = signal('');
  protected readonly parseError = signal('');
  protected readonly busy = signal(false);

  protected readonly validCount = computed(
    () => this.rows().filter((r) => r.errors.length === 0).length,
  );

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  downloadTemplate(): void {
    void this.excel.downloadTemplate();
  }

  openPicker(): void {
    this.fileInput().nativeElement.click();
  }

  clear(): void {
    this.rows.set([]);
    this.fileName.set('');
    this.parseError.set('');
  }

  protected use(rec: ParsedPm): void {
    this.fill.emit(rec);
    this.clear();
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clear();
    this.fileName.set(file.name);
    this.busy.set(true);
    try {
      const rows = await this.excel.parse(file);
      if (rows.length === 0) {
        this.parseError.set('No PM records found in the file.');
      } else if (rows.length === 1 && rows[0].errors.length === 0) {
        this.use(rows[0]);
      } else {
        this.rows.set(rows);
      }
    } catch (e) {
      this.parseError.set(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }
}
