import { Component, input, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AnnulusData, AnnulusType, IntegrityStatus } from '../../../core/models/well-integrity.models';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-annulus-tab',
  standalone: true,
  imports: [ReactiveFormsModule, StatusBadge],
  templateUrl: './annulus-tab.html',
})
export class AnnulusTab implements OnChanges {
  annulusType = input.required<AnnulusType>();
  existingData = input<AnnulusData | null>(null);
  annulusStatus = input<IntegrityStatus>('no-data');

  readonly form = new FormGroup({
    toc:       new FormControl<number | null>(null),
    cblToc:    new FormControl<number | null>(null),
    shoeDepth: new FormControl<number | null>(null),
    masp:      new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    mop:       new FormControl<number | null>(null, [Validators.min(0)]),
    tow:       new FormControl<number | null>(null),
    updatedBy: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingData']) {
      const data = this.existingData();
      if (data) {
        this.form.patchValue({
          toc: data.toc,
          cblToc: data.cblToc,
          shoeDepth: data.shoeDepth,
          masp: data.masp,
          mop: data.mop,
          tow: data.tow,
          updatedBy: data.updatedBy,
        });
      } else {
        this.form.reset();
      }
    }
  }
}
