import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DEFAULT_INTEGRITY_CONFIG } from '../../../core/constants/integrity-defaults';
import { IntegrityConfig, RuleSeverity } from '../../../core/models/well-integrity.models';
import { IntegrityConfigService } from '../../../core/services/integrity-config.service';

type LeakFnKey = 'xtValve' | 'annulusValve' | 'dhsv';
type SingleRuleKey = 'packoffLeak' | 'thgrPortLeak' | 'tubingFail';

const num = (v: number, min: number | null = 0) =>
  new FormControl<number>(v, {
    nonNullable: true,
    validators: [Validators.required, ...(min === null ? [] : [Validators.min(min)])],
  });
const sev = (v: RuleSeverity) => new FormControl<RuleSeverity>(v, { nonNullable: true });
const leakFnGroup = (v: IntegrityConfig['rules'][LeakFnKey]) =>
  new FormGroup({ leakOnly: sev(v.leakOnly), fnOnly: sev(v.fnOnly), both: sev(v.both) });

/** warning threshold must sit below the fail threshold, otherwise the warning band never applies. */
function warningBelowFail(group: AbstractControl): ValidationErrors | null {
  const w = group.get('warningRatio')?.value as number | null;
  const f = group.get('failRatio')?.value as number | null;
  return w != null && f != null && w >= f ? { warningNotBelowFail: true } : null;
}

@Component({
  selector: 'app-integrity-config',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './integrity-config.html',
})
export class IntegrityConfigPage {
  private readonly configService = inject(IntegrityConfigService);

  protected readonly severities: { value: RuleSeverity; label: string }[] = [
    { value: 'pass', label: 'Pass (green)' },
    { value: 'warning', label: 'Warning (yellow)' },
    { value: 'fail', label: 'Fail (red)' },
  ];

  protected readonly leakFnRules: { key: LeakFnKey; label: string; hint: string }[] = [
    { key: 'xtValve', label: 'XT valves', hint: 'UMV, LMV, WV, KWV, SV → XT light' },
    {
      key: 'annulusValve',
      label: 'Annulus casing valves',
      hint: 'A/B/C annulus valves (incl. 2nd valves) → WH light',
    },
    { key: 'dhsv', label: 'DHSV', hint: 'DHSV leak rate + function test → DHSV light' },
  ];

  protected readonly leakFnColumns = ['leakOnly', 'fnOnly', 'both'] as const;

  protected readonly singleRules: { key: SingleRuleKey; label: string; hint: string }[] = [
    { key: 'packoffLeak', label: 'Casing pack-off leak', hint: '7" and 9-5/8" pack-offs → WH light' },
    { key: 'thgrPortLeak', label: 'Tubing-hanger port leak', hint: 'Ports A, B, C, D → THGR light' },
    { key: 'tubingFail', label: 'Tubing status = Fail', hint: 'TBG light' },
  ];

  protected readonly form = this.buildForm(this.configService.config());
  private readonly formTick = toSignal(this.form.valueChanges, { initialValue: null });

  protected readonly saving = signal(false);
  protected readonly message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly persisted = this.configService.persisted;
  protected readonly updatedAt = computed(() => this.configService.config().updatedAt);

  protected readonly dirty = computed(() => {
    this.formTick();
    return this.form.dirty;
  });

  constructor() {
    // The config loads asynchronously; sync the form to it unless the admin has already started editing.
    effect(() => {
      const c = this.configService.config();
      if (!this.form.dirty) this.form.reset(this.toFormValue(c));
    });
  }

  private toFormValue(c: IntegrityConfig) {
    return {
      updatedBy: c.updatedBy,
      leakTest: c.leakTest,
      annulusPressure: c.annulusPressure,
      mesp: c.mesp,
      barrier: c.barrier,
      rules: c.rules,
    };
  }

  private buildForm(c: IntegrityConfig) {
    return new FormGroup({
      updatedBy: new FormControl<string>(c.updatedBy, { nonNullable: true }),
      leakTest: new FormGroup({
        passRatio: new FormControl<number>(c.leakTest.passRatio, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0), Validators.max(1)],
        }),
        observeMaxPressure: num(c.leakTest.observeMaxPressure),
        dhsvLeakRateLimit: num(c.leakTest.dhsvLeakRateLimit),
        dhsvLeakRateDivisor: new FormControl<number>(c.leakTest.dhsvLeakRateDivisor, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0.0001)],
        }),
      }),
      annulusPressure: new FormGroup(
        { warningRatio: num(c.annulusPressure.warningRatio), failRatio: num(c.annulusPressure.failRatio) },
        { validators: warningBelowFail },
      ),
      mesp: new FormGroup(
        { warningRatio: num(c.mesp.warningRatio), failRatio: num(c.mesp.failRatio) },
        { validators: warningBelowFail },
      ),
      barrier: new FormGroup({
        cblTocMargin: num(c.barrier.cblTocMargin, null),
        volTocMargin: num(c.barrier.volTocMargin, null),
      }),
      rules: new FormGroup({
        xtValve: leakFnGroup(c.rules.xtValve),
        annulusValve: leakFnGroup(c.rules.annulusValve),
        dhsv: leakFnGroup(c.rules.dhsv),
        packoffLeak: sev(c.rules.packoffLeak),
        thgrPortLeak: sev(c.rules.thgrPortLeak),
        tubingFail: sev(c.rules.tubingFail),
      }),
    });
  }

  protected leakFnGroupOf(key: LeakFnKey): FormGroup {
    return this.form.controls.rules.get(key) as FormGroup;
  }

  protected percentDrop(): number {
    return Math.round((1 - this.form.controls.leakTest.controls.passRatio.value) * 1000) / 10;
  }

  protected resetToDefaults(): void {
    this.form.reset(this.toFormValue(DEFAULT_INTEGRITY_CONFIG));
    this.form.markAsDirty();
    this.message.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    this.configService.save(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.message.set({ kind: 'ok', text: 'Saved. Traffic lights now use this logic.' });
      },
      error: () => {
        this.saving.set(false);
        this.message.set({ kind: 'error', text: 'Save failed — is json-server running?' });
      },
    });
  }
}
