import { Component, signal } from '@angular/core';
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
    { label: 'PM Records', icon: 'wrench', route: '/pm-records' },
    { label: 'CM Records', icon: 'wrench-repair', route: '/cm-records' },
    {
      label: 'Well Integrity',
      icon: 'database',
      children: [
        { label: 'Engineering Data', route: '/well-data/engineering-data' },
        { label: 'Observation Report', route: '/well-data/failure-report' },
      ],
    },
    { label: 'Integrity Report', icon: 'chart', route: '/report' },
  ];

  protected readonly expandedGroups = signal<ReadonlySet<string>>(
    new Set(this.navItems.filter((i) => i.children).map((i) => i.label)),
  );

  protected toggleGroup(label: string): void {
    const next = new Set(this.expandedGroups());
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    this.expandedGroups.set(next);
  }
}
