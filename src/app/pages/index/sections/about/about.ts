import { ChangeDetectionStrategy, Component } from '@angular/core';

// "Who I am" y "Tech lead" (secciones 2 y 3). Solo maquetación y estilos: los anima
// el timeline de Index, que los busca por id.
@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrls: ['./about.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {}
