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
        path: 'well-data',
        loadComponent: () =>
          import('./features/well-data/well-data-form/well-data-form').then(m => m.WellDataForm),
      },
      {
        path: 'report',
        loadComponent: () => import('./features/report/report').then(m => m.Report),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
