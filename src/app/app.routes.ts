import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', redirectTo: 'pm-records', pathMatch: 'full' },
      {
        path: 'pm-records',
        loadComponent: () => import('./features/pm-records/pm-list/pm-list').then(m => m.PmList),
      },
      {
        path: 'pm-records/new',
        loadComponent: () => import('./features/pm-records/pm-form/pm-form').then(m => m.PmForm),
      },
      {
        path: 'pm-records/edit/:id',
        loadComponent: () => import('./features/pm-records/pm-form/pm-form').then(m => m.PmForm),
      },
      {
        path: 'cm-records',
        loadComponent: () => import('./features/cm-records/cm-list/cm-list').then(m => m.CmList),
      },
      {
        path: 'cm-records/new',
        loadComponent: () => import('./features/cm-records/cm-form/cm-form').then(m => m.CmForm),
      },
      {
        path: 'cm-records/edit/:id',
        loadComponent: () => import('./features/cm-records/cm-form/cm-form').then(m => m.CmForm),
      },
      { path: 'well-data', redirectTo: 'well-data/engineering-data', pathMatch: 'full' },
      {
        path: 'well-data/engineering-data',
        loadComponent: () =>
          import('./features/well-data/well-data-form/well-data-form').then(m => m.WellDataForm),
      },
      {
        path: 'well-data/failure-report',
        loadComponent: () =>
          import('./features/well-data/failure-report/failure-report').then(m => m.FailureReportForm),
      },
      {
        path: 'report',
        loadComponent: () => import('./features/report/report').then(m => m.Report),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
