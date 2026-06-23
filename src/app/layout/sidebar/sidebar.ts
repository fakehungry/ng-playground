import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly navItems: NavItem[] = [
    { label: 'PM Records',        icon: 'wrench',  route: '/pm-records' },
    { label: 'Well Data Input',   icon: 'database', route: '/well-data' },
    { label: 'Integrity Report',  icon: 'chart',   route: '/report' },
  ];
}
