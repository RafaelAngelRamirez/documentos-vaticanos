import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-lector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lector.component.html',
  styleUrls: ['./lector.component.css'],
})
export class LectorComponent {
  constructor(route: ActivatedRoute) {
    const id: Observable<string> = route.params.pipe(map((p) => p['id']));

    const url: Observable<string> = route.url.pipe(
      map((segments) => segments.join(''))
    );

    url.subscribe((ur) => console.log(ur));

    // route.data includes both `data` and `resolve`
    const user = route.data.pipe(map((d) => d['user']));
    user.subscribe((us) => console.log(us));
  }
}
