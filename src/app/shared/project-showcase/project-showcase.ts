import { Component, ElementRef, Input, ViewChild, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ProjectStoryData } from '../../pages/index/project-stories.data';

gsap.registerPlugin(ScrollTrigger);

interface CoverTarget {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Duración relativa (unidades de timeline, no segundos reales — el scrub las
// estira sobre el tramo de scroll real) de un ciclo de proyecto completo.
// Igual para todos los proyectos para que cada uno ocupe el mismo tramo de
// scroll. Desglose: dwell inicial (1.3) + fade del hero/entrada de
// texto-media (2.2) + hueco (0.5) + expansión (1.6) + delay de la quote (0.3)
// + entrada de la quote (0.8) + espera antes de cerrar (0.7) = 7.4.
// El fade+entrada (2.2 de 7.4 ≈ 30% del tramo, antes era ~1.0 de 5.7 ≈ 17%)
// se alargó a propósito: con menos scroll que eso, texto/tarjetas terminaban
// de aparecer en un único gesto de scroll y se sentía instantáneo, no ligado
// al progreso real.
const SEGMENT_DURATION = 7.4;

// Scroll real (en alturas de viewport) que ocupa cada proyecto. 3 encaja en
// el rango 200-300vh+ pedido y da margen para que el alargue de arriba se
// note como progreso de scroll, no como otro salto rápido.
const VH_PER_PROJECT = 3;

@Component({
  selector: 'app-project-showcase',
  templateUrl: './project-showcase.html',
  styleUrls: ['./project-showcase.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectShowcase implements AfterViewInit, OnDestroy {
  @Input({ required: true }) projects!: ProjectStoryData[];

  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  private timeline: gsap.core.Timeline | null = null;
  private resizeHandler: (() => void) | null = null;
  private resizeDebounce: ReturnType<typeof setTimeout> | null = null;
  private buildTimeout: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit() {
    // Angular ejecuta ngAfterViewInit de los hijos ANTES que el del padre
    // (Index), que es quien colapsa las secciones 2-5 y monta el pin
    // maestro del timeline (ver timeLine() en index.ts). Si midiéramos aquí
    // mismo, el documento aún tendría su altura "sin colapsar" y el
    // ScrollTrigger de este bloque quedaría con un start desfasado. Se
    // difiere al siguiente tick, cuando ese layout ya está asentado.
    this.buildTimeout = setTimeout(() => this.build(), 0);

    this.resizeHandler = () => {
      if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
      // Index tiene su propio listener de resize que recolapsa las
      // secciones 2-5 y reconstruye el pin maestro con un debounce de
      // 200ms (rebuildTimeline() en index.ts). Este debounce va más largo
      // a propósito, para medir siempre DESPUÉS de que ese layout se haya
      // asentado.
      this.resizeDebounce = setTimeout(() => this.rebuild(), 300);
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    if (this.buildTimeout) clearTimeout(this.buildTimeout);
    this.timeline?.scrollTrigger?.kill();
    this.timeline?.kill();

    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
  }

  private queryAll(selector: string): HTMLElement[] {
    return Array.from(this.rootRef.nativeElement.querySelectorAll<HTMLElement>(selector));
  }

  private rebuild() {
    this.timeline?.scrollTrigger?.kill();
    this.timeline?.kill();

    gsap.set(
      this.queryAll(
        '.project-showcase__hero, .project-showcase__title, .project-showcase__subtitle, ' +
          '.project-showcase__description, .project-showcase__card, .project-showcase__expand-icon, ' +
          '.project-showcase__quote',
      ),
      { clearProps: 'all' },
    );

    this.build();
    ScrollTrigger.refresh();
  }

  // Escala+traslada (relativo a la caja de reposo del elemento, sin
  // transform aplicado) lo necesario para que visualmente cubra `target`.
  // Como las tarjetas viven dentro de contenedores position:fixed, su
  // getBoundingClientRect() ya es viewport-relativo de por sí — no hace
  // falta normalizar contra ningún offset de documento.
  private coverTransform(rect: DOMRect, target: CoverTarget) {
    const scaleX = target.width / rect.width;
    const scaleY = target.height / rect.height;
    const currentCenterX = rect.left + rect.width / 2;
    const currentCenterY = rect.top + rect.height / 2;
    const targetCenterX = target.left + target.width / 2;
    const targetCenterY = target.top + target.height / 2;
    return { scaleX, scaleY, x: targetCenterX - currentCenterX, y: targetCenterY - currentCenterY };
  }

  private build() {
    const n = this.projects.length;
    const heroes = this.queryAll('.project-showcase__hero');
    const titles = this.queryAll('.project-showcase__title');
    const subtitles = this.queryAll('.project-showcase__subtitle');
    const descriptions = this.queryAll('.project-showcase__description');
    const primaryCards = this.queryAll('.project-showcase__card--primary');
    const secondaryCards = this.queryAll('.project-showcase__card--secondary');
    const expandIcons = this.queryAll('.project-showcase__expand-icon');
    const quotes = this.queryAll('.project-showcase__quote');

    const viewportTarget: CoverTarget = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };

    // Las cajas de reposo de las tarjetas se miden ANTES de tocar nada (ni
    // gsap.set del estado inicial, ni la creación del ScrollTrigger/pin):
    // el propio proceso de montar el pin toca brevemente el layout del
    // trigger, y si mides después el resultado sale contaminado (aunque
    // estas capas sean position:fixed). Midiendo primero, en limpio, el
    // getBoundingClientRect() es el real viewport-relativo.
    const expandTransforms = primaryCards.map((card) => this.coverTransform(card.getBoundingClientRect(), viewportTarget));

    // Estado inicial: todo oculto salvo el hero del primer proyecto (Fase 0
    // — portada a pantalla completa, estática, sin texto).
    gsap.set(heroes, { opacity: 0 });
    gsap.set(heroes[0], { opacity: 1 });
    gsap.set([...titles, ...subtitles, ...descriptions, ...primaryCards, ...secondaryCards], { opacity: 0, y: 56 });
    gsap.set(expandIcons, { opacity: 1 });
    gsap.set(quotes, { opacity: 0, y: 20 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: this.rootRef.nativeElement,
        start: 'top top',
        end: '+=' + n * window.innerHeight * VH_PER_PROJECT,
        pin: true,
        pinType: 'fixed',
        scrub: 1,
      },
    });
    this.timeline = tl;

    for (let i = 0; i < n; i++) {
      const hero = heroes[i];
      const title = titles[i];
      const subtitle = subtitles[i];
      const description = descriptions[i];
      const primaryCard = primaryCards[i];
      const secondaryCard = secondaryCards[i];
      const expandIcon = expandIcons[i];
      const quote = quotes[i];

      const segStart = i * SEGMENT_DURATION;
      tl.addLabel(`p${i}Start`, segStart);

      if (i > 0) {
        // Fase 6 del proyecto anterior == Fase 0 de este: el vídeo+quote a
        // pantalla completa del proyecto anterior se desvanece (fade,
        // nunca scale) EN PARALELO con el fade-in del hero de este
        // proyecto — un crossfade real, ambos ligados al mismo tramo de
        // scroll. El texto y la tarjeta secundaria del anterior también se
        // apagan aquí: ya estaban tapados por su tarjeta expandida, así que
        // esto no se ve como una animación aparte, solo evita que
        // "reaparezcan" al desvanecerse lo que los tapaba.
        const prevPrimary = primaryCards[i - 1];
        const prevSecondary = secondaryCards[i - 1];
        const prevQuote = quotes[i - 1];
        const prevTitle = titles[i - 1];
        const prevSubtitle = subtitles[i - 1];
        const prevDescription = descriptions[i - 1];
        tl.to(
          [prevPrimary, prevSecondary, prevQuote, prevTitle, prevSubtitle, prevDescription],
          { opacity: 0, ease: 'none', duration: 1 },
          `p${i}Start`,
        );
        tl.to(hero, { opacity: 1, ease: 'none', duration: 1 }, `p${i}Start`);
        tl.addLabel(`p${i}HeroVisible`, `p${i}Start+=1`);
      } else {
        tl.addLabel(`p${i}HeroVisible`, `p${i}Start`);
      }

      // Fase 1 + Fase 2/3: MISMO punto de partida del timeline (posición
      // `p{i}FadeStart`) y, sobre todo, MISMO PUNTO DE LLEGADA para todos
      // (`p{i}FadeStart + heroFadeDuration`): en vez de escalonar con
      // duraciones iguales (lo que deja a cada tween terminando en un
      // instante distinto y crea la sensación de "esto ya terminó, ahora
      // sigue lo otro"), aquí se escalona el ARRANQUE y se compensa la
      // duración para que el título, subtítulo, párrafo y tarjetas lleguen
      // a su posición final EXACTAMENTE cuando el hero termina de
      // desvanecerse. Con ease:'none' en todos (nada de deceleración): el
      // progreso de opacity/translateY es literalmente proporcional al
      // progreso de scroll en todo momento, igual que el fade del vídeo, así
      // que no hay ningún punto donde "el texto ya se ve terminado" antes
      // de que el vídeo lo esté.
      const heroFadeDuration = 2.2;
      const staggerStarts = [0, 0.15, 0.3]; // título, subtítulo, párrafo
      tl.addLabel(`p${i}FadeStart`, `p${i}HeroVisible+=${i === 0 ? 1.3 : 0.3}`);
      tl.to(hero, { opacity: 0, ease: 'none', duration: heroFadeDuration }, `p${i}FadeStart`);
      tl.to(title, { opacity: 1, y: 0, ease: 'none', duration: heroFadeDuration - staggerStarts[0] }, `p${i}FadeStart+=${staggerStarts[0]}`);
      tl.to(subtitle, { opacity: 1, y: 0, ease: 'none', duration: heroFadeDuration - staggerStarts[1] }, `p${i}FadeStart+=${staggerStarts[1]}`);
      tl.to(description, { opacity: 1, y: 0, ease: 'none', duration: heroFadeDuration - staggerStarts[2] }, `p${i}FadeStart+=${staggerStarts[2]}`);
      tl.to(primaryCard, { opacity: 1, y: 0, ease: 'none', duration: heroFadeDuration - staggerStarts[0] }, `p${i}FadeStart+=${staggerStarts[0]}`);
      tl.to(secondaryCard, { opacity: 1, y: 0, ease: 'none', duration: heroFadeDuration - staggerStarts[1] }, `p${i}FadeStart+=${staggerStarts[1]}`);
      tl.addLabel(`p${i}Settled`, `p${i}FadeStart+=${heroFadeDuration}`);

      // Fase 4: ÚNICA fase con scale real — la tarjeta primaria crece hasta
      // cubrir el 100% del viewport, border-radius a 0. Texto y la otra
      // tarjeta quedan debajo sin necesitar animación de salida propia.
      tl.addLabel(`p${i}Expand`, `p${i}Settled+=0.5`);
      const expandTransform = expandTransforms[i];
      // z-index 5: por encima del hero(1)/tarjetas(2)/texto(3), pero por
      // debajo de la quote(6), que tiene que quedar visible ENCIMA de esta
      // tarjeta una vez a pantalla completa.
      tl.set(primaryCard, { zIndex: 5, transformOrigin: 'center center' }, `p${i}Expand`);
      tl.to(
        primaryCard,
        {
          scaleX: expandTransform.scaleX,
          scaleY: expandTransform.scaleY,
          x: expandTransform.x,
          y: expandTransform.y,
          borderRadius: 0,
          ease: 'none',
          duration: 1.6,
        },
        `p${i}Expand`,
      );
      tl.to(expandIcon, { opacity: 0, ease: 'none', duration: 0.3 }, `p${i}Expand`);
      tl.addLabel(`p${i}Fullscreen`, `p${i}Expand+=1.6`);

      // Fase 5: quote sobre el vídeo a pantalla completa, esquina inferior
      // izquierda, mismo estilo slide-up + fade que el texto.
      tl.to(quote, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.8 }, `p${i}Fullscreen+=0.3`);
      tl.addLabel(`p${i}CycleClose`, `p${i}Fullscreen+=1.8`);

      // Último proyecto: sin siguiente que haga crossfade, cierra en fade a
      // oscuridad para dar paso al resto de la página.
      if (i === n - 1) {
        tl.to(
          [primaryCard, secondaryCard, quote, title, subtitle, description],
          { opacity: 0, ease: 'none', duration: 1 },
          `p${i}CycleClose`,
        );
      }
    }
  }
}
