import { ChangeDetectionStrategy, Component } from '@angular/core';

// "Let's talk": contacto, redes, botón del CV y pie. Los degradados animados
// de los enlaces y del botón los pone en marcha/pausa Index (ver
// observeAnimatedGradients) según estén en pantalla.
@Component({
  selector: 'app-contact',
  templateUrl: './contact.html',
  styleUrls: ['./contact.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contact {
  readonly currentYear = new Date().getFullYear();
}
