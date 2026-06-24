import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavChild {
  label: string;
  route: string;
}

interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavChild[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly navItems: NavItem[] = [
    { label: 'PM Records',       icon: 'wrench',  route: '/pm-records' },
    {
      label: 'Well Integrity',   icon: 'database',
      children: [
        { label: 'Engineering Data', route: '/well-data/engineering-data' },
        { label: 'Failure Report',   route: '/well-data/failure-report' },
      ],
    },
    { label: 'Integrity Report', icon: 'chart',   route: '/report' },
  ];
}
