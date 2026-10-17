import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ProjectMedia, ProjectStoryData } from '../../pages/index/project-stories.data';
import { ScrubCanvas, VideoFrames, extractionGate } from './video-frames';

gsap.registerPlugin(ScrollTrigger);

export interface MediaOpenEvent {
  media: ProjectMedia;
  origin: HTMLElement;
}

interface Shot extends ProjectMedia {
  width: string;
  ratio: string;
}

interface Chapter {
  variant: 'name' | 'quote';
  align: 'left' | 'right';
  media: ProjectMedia;
  heading: string;
  subtitle?: string;
  body?: string;
  columns: [Shot[], Shot[]];
}

// Tamaños de la galería masonry: la columna A lleva las fotos grandes y
// arranca más abajo; la B, las pequeñas. Se reparten las fotos alternando
// columna y ciclando estos formatos.
const COLUMN_A_SHAPES = [
  { width: '40vw', ratio: '4 / 3' },
  { width: '32vw', ratio: '1 / 1' },
];
const COLUMN_B_SHAPES = [
  { width: '22vw', ratio: '3 / 4' },
  { width: '22vw', ratio: '4 / 3' },
  { width: '18vw', ratio: '2 / 3' },
];

// Puntos de scroll de cada fase (formato ScrollTrigger "<elemento> <viewport>").
// El resto del ritmo lo marcan las alturas del CSS (--spacer, margin-top de
// copy y galería, min-height de la galería).
const TIMING = {
  fadeFromNavy: 0.6, // capítulos 2+: .bg-dim 1 → 0 en este nº de viewports, ya fijo arriba
  pushInScale: 1.08,
  titleIn: ['top 90%', 'top 65%'],
  quoteIn: ['top bottom', 'top 72%'],
  copyIn: ['top 95%', 'top 75%'],
  dimStart: 'top 75%', // trigger: copy (o la galería si el capítulo no tiene copy)
  dimEnd: 'top 50%', // trigger: galería
} as const;

// La extracción de fotogramas (que descarga y reproduce cada vídeo entero)
// arranca con la portada ya escrita (ms tras cargar, en un momento libre del
// navegador): mientras se hace scroll lejos de los proyectos está en pausa
// (ver extractionGate), así que aprovecha los ratos sin scroll, y la portada
// es el más seguro. Con "ahorro de datos" activado espera al primer scroll
// (px), para no descargar los vídeos a quien no pase de la portada.
const EXTRACTION_DELAY_MS = 3500;
const EXTRACTION_SAVE_DATA_START_PX = 50;

// A esta distancia de los proyectos (márgenes del IntersectionObserver) la
// extracción ya no se pausa con el scroll: hacen falta los fotogramas. En 0:
// con más margen, los proyectos ya cuentan como "cerca" durante el carrusel
// de habilidades (justo encima), que es donde más se notaba la extracción.
const EXTRACTION_NEAR_MARGIN = '0px';

// Tiempo sin scroll tras el que se reanuda la extracción de vídeos.
const SCROLL_IDLE_MS = 250;

@Component({
  selector: 'app-project-showcase',
  templateUrl: './project-showcase.html',
  styleUrls: ['./project-showcase.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectShowcase implements AfterViewInit, OnDestroy {
  @Input({ required: true }) set projects(projects: ProjectStoryData[]) {
    this.chapters = projects.flatMap((project, i): Chapter[] => [
      {
        variant: 'name',
        align: i % 2 === 0 ? 'left' : 'right',
        media: project.videoPortada,
        heading: project.titulo,
        subtitle: project.subtitulo,
        body: project.descripcion,
        columns: this.toColumns(project.galeria),
      },
      {
        // En la referencia la cita va siempre abajo a la izquierda.
        variant: 'quote',
        align: 'left',
        media: project.mediaQuote,
        heading: project.quote,
        subtitle: project.subtituloQuote,
        body: project.descripcionQuote,
        columns: this.toColumns(project.galeriaQuote),
      },
    ]);
  }

  @Output() mediaOpen = new EventEmitter<MediaOpenEvent>();

  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  chapters: Chapter[] = [];

  private ctx: gsap.Context | null = null;
  private extractionReady = false;
  private mm = gsap.matchMedia();
  private frames = new Map<string, VideoFrames>();
  private players: { player: ScrubCanvas; active: boolean }[] = [];
  private shotVideoObserver: IntersectionObserver | null = null;
  private resizeHandler = () => this.players.forEach(({ player }) => player.resize());
  // La extracción de vídeos se pausa mientras se hace scroll por el resto de
  // la página y se reanuda al parar (ver extractionGate). Con los proyectos
  // cerca (EXTRACTION_NEAR_MARGIN) nunca se pausa: ahí hacen falta los
  // fotogramas cuanto antes.
  private rootVisible = false;
  private extractionTimer = 0;
  private rootObserver: IntersectionObserver | null = null;
  private scrollIdleTimer = 0;
  private scrollHandler = () => {
    if (this.rootVisible) return;
    extractionGate.set(true);
    clearTimeout(this.scrollIdleTimer);
    this.scrollIdleTimer = window.setTimeout(() => extractionGate.set(false), SCROLL_IDLE_MS);
  };
  private tick = () => this.players.forEach(({ player, active }) => active && player.tick());

  ngAfterViewInit() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ctx = gsap.context(() => this.build(reduceMotion), this.rootRef.nativeElement);

    gsap.ticker.add(this.tick);
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.rootObserver = new IntersectionObserver(([entry]) => {
      this.rootVisible = entry.isIntersecting;
      if (this.rootVisible) extractionGate.set(false);
    }, { rootMargin: EXTRACTION_NEAR_MARGIN });
    this.rootObserver.observe(this.rootRef.nativeElement);
    this.observeShotVideos();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }

  // Extrae los vídeos en orden de aparición. Si el usuario llega antes a un
  // capítulo, ese se adelanta (ver build()).
  private async extractAll() {
    for (const frames of this.frames.values()) {
      await frames.extract().catch(() => {});
    }
  }

  ngOnDestroy() {
    this.shotVideoObserver?.disconnect();
    this.rootObserver?.disconnect();
    window.removeEventListener('scroll', this.scrollHandler);
    clearTimeout(this.scrollIdleTimer);
    clearTimeout(this.extractionTimer);
    extractionGate.set(false);
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.resizeHandler);
    this.ctx?.revert();
    this.mm.revert();
    this.frames.forEach((frames) => frames.dispose());
    this.frames.clear();
    this.players = [];
  }

  private observeShotVideos() {
    this.shotVideoObserver = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          const video = target as HTMLVideoElement;
          if (isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { rootMargin: '200px 0px' },
    );
    this.rootRef.nativeElement
      .querySelectorAll<HTMLVideoElement>('video.shot__media')
      .forEach((video) => this.shotVideoObserver!.observe(video));
  }

  private toColumns(media: ProjectMedia[]): [Shot[], Shot[]] {
    const a: Shot[] = [];
    const b: Shot[] = [];
    media.forEach((item, i) => {
      const column = i % 2 === 0 ? a : b;
      const shapes = i % 2 === 0 ? COLUMN_A_SHAPES : COLUMN_B_SHAPES;
      column.push({ ...item, ...shapes[column.length % shapes.length] });
    });
    return [a, b];
  }

  private framesFor(src: string): VideoFrames {
    let frames = this.frames.get(src);
    if (!frames) {
      frames = new VideoFrames(src);
      this.frames.set(src, frames);
    }
    return frames;
  }

  private build(reduceMotion: boolean) {
    const root = this.rootRef.nativeElement;
    // Prioridad baja: estos triggers se miden DESPUÉS del pin maestro de
    // Index, que va por encima en la página y cambia su altura al montarse.
    const st = (vars: ScrollTrigger.Vars): ScrollTrigger.Vars => ({ refreshPriority: -1, ...vars });

    // Los triggers se crean antes de que Index monte su pin (que alarga la
    // página), así que en su primera evaluación el bloque de proyectos parece
    // estar arriba del todo y "entrarían" nada más cargar. La extracción se
    // habilita, y su trigger se crea, tras el primer refresh, con el layout
    // ya definitivo.
    const onFirstRefresh = () => {
      ScrollTrigger.removeEventListener('refresh', onFirstRefresh);
      this.extractionReady = true;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      if (saveData) {
        ScrollTrigger.create(st({ start: EXTRACTION_SAVE_DATA_START_PX, once: true, onEnter: () => this.extractAll() }));
      } else {
        this.extractionTimer = window.setTimeout(() => {
          if ('requestIdleCallback' in window) requestIdleCallback(() => this.extractAll(), { timeout: 2000 });
          else this.extractAll();
        }, EXTRACTION_DELAY_MS);
      }
    };
    ScrollTrigger.addEventListener('refresh', onFirstRefresh);

    root.querySelectorAll<HTMLElement>('.chapter').forEach((chapter, idx) => {
      const media = chapter.querySelector<HTMLElement>('.chapter__media')!;
      const dimEnter = chapter.querySelector<HTMLElement>('.chapter__dim--enter')!;
      const dimLeave = chapter.querySelector<HTMLElement>('.chapter__dim--leave')!;
      const title = chapter.querySelector<HTMLElement>('.chapter__title');
      const quoteHold = chapter.querySelector<HTMLElement>('.chapter__quote-hold');
      const quote = chapter.querySelector<HTMLElement>('.chapter__quote');
      const copy = chapter.querySelector<HTMLElement>('.copy');
      const gallery = chapter.querySelector<HTMLElement>('.gallery')!;

      // Del primero no hay capítulo anterior que tape la entrada: el stage
      // sube desde abajo mientras se aclara. Los demás entran cubiertos por
      // la galería anterior y se aclaran ya fijos arriba (si se aclarasen
      // mientras suben se vería el borde del stage cortando la pantalla).
      const sceneStart = idx === 0
        ? { start: 'top bottom', end: 'top top' }
        : { start: 'top top', end: () => `+=${window.innerHeight * TIMING.fadeFromNavy}` };

      // 1) Fade-in desde marino.
      gsap.fromTo(dimEnter, { opacity: 1 }, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: st({ trigger: chapter, ...sceneStart, scrub: true }),
      });

      // 2) Vídeo ligado al scroll + push-in, hasta que el fondo es marino sólido.
      const sceneRange = st({
        trigger: chapter,
        start: sceneStart.start,
        endTrigger: gallery,
        end: TIMING.dimEnd,
        scrub: true,
      });

      if (media instanceof HTMLCanvasElement) {
        const frames = this.framesFor(media.dataset['src']!);
        const entry = { player: new ScrubCanvas(media, frames), active: false };
        this.players.push(entry);

        if (reduceMotion) entry.player.setProgress(0.5);
        else ScrollTrigger.create({ ...sceneRange, onUpdate: (self) => entry.player.setProgress(self.progress) });

        // Solo se pinta mientras el capítulo está en pantalla; y si el
        // usuario llega antes de que acabe la extracción en cola, este vídeo
        // se adelanta.
        ScrollTrigger.create(st({
          trigger: chapter,
          start: 'top 300%',
          end: 'bottom top',
          onToggle: (self) => {
            entry.active = self.isActive;
            if (self.isActive && this.extractionReady) frames.extract().catch(() => {});
          },
        }));
      }

      if (!reduceMotion) {
        gsap.fromTo(media, { scale: 1 }, { scale: TIMING.pushInScale, ease: 'none', scrollTrigger: { ...sceneRange } });
      }

      // 3) Titular / cita.
      if (title && !reduceMotion) {
        gsap.fromTo(title, { opacity: 0, y: 60 }, {
          opacity: 1,
          y: 0,
          ease: 'power1.out',
          scrollTrigger: st({ trigger: title, start: TIMING.titleIn[0], end: TIMING.titleIn[1], scrub: true }),
        });
      }
      if (quote && quoteHold && !reduceMotion) {
        // Fase "fantasma" a ~30 % y luego opaca. La pausa sobre el vídeo la
        // hace el CSS (position: sticky dentro de .chapter__quote-hold).
        gsap.timeline({
          scrollTrigger: st({ trigger: quoteHold, start: TIMING.quoteIn[0], end: TIMING.quoteIn[1], scrub: true }),
        })
          .fromTo(quote, { opacity: 0, y: 60 }, { opacity: 0.3, y: 30, ease: 'none', duration: 0.4 })
          .to(quote, { opacity: 1, y: 0, ease: 'power1.out', duration: 0.6 });
      }

      // 4) Subtítulo + párrafo.
      if (copy && !reduceMotion) {
        gsap.fromTo(copy, { opacity: 0, y: 30 }, {
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: st({ trigger: copy, start: TIMING.copyIn[0], end: TIMING.copyIn[1], scrub: true }),
        });
        const body = copy.querySelector('.copy__body');
        if (body) {
          gsap.fromTo(body, { yPercent: 0 }, {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: st({ trigger: copy, start: 'top bottom', end: 'bottom top', scrub: true }),
          });
        }
      }

      // 5) Oscurecimiento hasta marino sólido. Capa propia (no la de
      // entrada) para que los dos tweens de opacidad nunca se pisen.
      gsap.fromTo(dimLeave, { opacity: 0 }, {
        opacity: 1,
        ease: 'none',
        scrollTrigger: st({
          trigger: copy ?? gallery,
          start: copy ? TIMING.dimStart : 'top bottom',
          endTrigger: gallery,
          end: TIMING.dimEnd,
          scrub: true,
        }),
      });

      // 6) Galería: parallax de la columna B + leve zoom-out de cada foto.
      if (!reduceMotion) {
        // En móvil las columnas van apiladas y el desfase las solaparía.
        this.mm.add('(min-width: 769px)', () => {
          gsap.fromTo(gallery.querySelector('.gallery__col--b'), { yPercent: 10 }, {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: st({ trigger: gallery, start: 'top bottom', end: 'bottom top', scrub: true }),
          });
        });
        gallery.querySelectorAll<HTMLElement>('.shot__media').forEach((shotMedia) => {
          gsap.fromTo(shotMedia, { scale: 1.06 }, {
            scale: 1,
            ease: 'none',
            scrollTrigger: st({ trigger: shotMedia, start: 'top bottom', end: 'top 40%', scrub: true }),
          });
        });
      }
    });

    // 7) Línea de gradiente al final del bloque.
    gsap.fromTo('.project-showcase__end-line', { scaleX: reduceMotion ? 1 : 0 }, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: st({ trigger: '.project-showcase__end-line', start: 'top bottom', end: 'top 70%', scrub: true }),
    });
  }
}
