import { ChangeDetectionStrategy, Component } from '@angular/core';

// "Why me?" (sección 4). Solo maquetación y estilos: la anima el timeline de Index.
@Component({
  selector: 'app-why-me',
  templateUrl: './why-me.html',
  styleUrls: ['./why-me.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyMe {}
