import { ChangeDetectionStrategy, Component } from '@angular/core';

// "Skills" (sección 5) con su carrusel. Solo maquetación y estilos: el panel y el
// carrusel los anima el timeline de Index.
@Component({
  selector: 'app-skills',
  templateUrl: './skills.html',
  styleUrls: ['./skills.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skills {}
