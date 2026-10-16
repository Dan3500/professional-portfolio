import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { MediaOpenEvent, ProjectShowcase } from '../../shared/project-showcase/project-showcase';
import { PROJECTS, ProjectMedia } from './project-stories.data';

gsap.registerPlugin(ScrollTrigger);

// Evita que el pin recalcule a mitad de gesto cuando la barra de
// direcciones del móvil se encoge/expande.
ScrollTrigger.config({ ignoreMobileResize: true });

// Escala máxima de los textos de las secciones 2 y 3, que se maquetan ya a ese
// tamaño y se animan por debajo de 1 (ver $intro-text-scale en index.scss).
// La máscara circular se amplía en la misma proporción para que se abra igual.
const INTRO_TEXT_SCALE = 1.65;
const INTRO_TEXT_MASK_OPEN = `${300 * INTRO_TEXT_SCALE}vmax ${300 * INTRO_TEXT_SCALE}vmax`;
// Tramo del timeline en que el degradado recorre los textos (en unidades del
// timeline, desde que empieza a abrirse su máscara).
const INTRO_COLOR_DELAY = 0.35;
const INTRO_COLOR_DURATION = 0.8;

interface Project {
  image: string;
  title: string;
  description: string;
  specs: string[];
}

@Component({
  selector: 'app-index',
  templateUrl: './index.html',
  styleUrls: ['./index.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectShowcase],
})
export class Index implements AfterViewInit, OnDestroy {
  @ViewChild('particlesCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('typedText', { static: true }) typedTextRef!: ElementRef<HTMLSpanElement>;
  @ViewChild('introAvatar', { static: true }) introAvatarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('introArrow', { static: true }) introArrowRef!: ElementRef<HTMLSpanElement>;
  @ViewChild('avatarButton', { static: true }) avatarButtonRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('galleryOverlay', { static: true }) galleryOverlayRef!: ElementRef<HTMLDivElement>;
  @ViewChild('galleryTrack', { static: true }) galleryTrackRef!: ElementRef<HTMLDivElement>;
  @ViewChild('projectModal', { static: true }) projectModalRef!: ElementRef<HTMLDivElement>;
  @ViewChild('mediaLightbox', { static: true }) mediaLightboxRef!: ElementRef<HTMLDivElement>;

  currentYear = new Date().getFullYear();

  // Typing effect
  fullText = "Hello! I'm\nDaniel Soltero";
  typingSpeed = 60;
  currentText = '';
  isTyping = true;
  private readonly highlightText = 'Daniel Soltero';
  private typingTween: gsap.core.Tween | null = null;

  // Particles canvas
  private resizeHandler: (() => void) | null = null;
  private particlesRafId: number | null = null;
  private drawParticles: (() => void) | null = null;
  private introVisible = true;
  private visibilityHandler: (() => void) | null = null;

  // Smooth scroll + pinned timeline
  private lenis: Lenis | null = null;
  private scrollTimeline: gsap.core.Timeline | null = null;
  private timelineResizeHandler: (() => void) | null = null;
  private timelineResizeDebounce: ReturnType<typeof setTimeout> | null = null;

  // Avatar gallery
  galleryImages = [
    'assets/img/gallery-1.jpg',
    'assets/img/gallery-2.jpg',
    'assets/img/gallery-3.jpg',
    'assets/img/gallery-4.jpg',
    'assets/img/gallery-5.jpg',
  ];
  isGalleryOpen = false;
  private galleryTween: gsap.core.Tween | null = null;
  private galleryKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  // Projects
  // E-commerce Platform, SaaS Dashboard y Banking App tienen su propio
  // bloque cinematográfico (ver projectStories / #section-project-stories);
  // el resto se queda en este grid compacto.
  // TODO: reemplazar por los proyectos, imágenes y specs reales.
  projects: Project[] = [
    {
      image: 'assets/img/project-3.jpg',
      title: 'Marketing Site',
      description: 'Landing corporativa con animaciones de scroll y formulario de contacto integrado con CRM.',
      specs: ['Stack: Angular, GSAP, SCSS', 'Animaciones de scroll', 'Integración con CRM', 'SEO optimizado'],
    },
    {
      image: 'assets/img/project-5.jpg',
      title: 'Real Estate Listings',
      description: 'Portal de anuncios inmobiliarios con filtros avanzados, mapa interactivo y fichas de propiedad.',
      specs: ['Stack: Angular, Google Maps API', 'Filtros avanzados de búsqueda', 'Galería de imágenes por propiedad', 'Carga progresiva (lazy loading)'],
    },
  ];
  showcaseProjects = PROJECTS;
  activeProject: Project | null = null;
  private projectModalTween: gsap.core.Timeline | gsap.core.Tween | null = null;
  private projectModalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  activeMedia: ProjectMedia | null = null;
  private mediaOrigin: HTMLElement | null = null;
  private mediaLightboxTween: gsap.core.Timeline | gsap.core.Tween | null = null;
  private mediaLightboxKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  // Menu
  isMenuOpen = false;
  private menuTween: gsap.core.Timeline | gsap.core.Tween | null = null;
  private menuKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.initLenis();
    this.startTyping();
    this.initParticles();
    this.timeLine();

    // <app-project-showcase> mide su layout en su propio ngAfterViewInit,
    // que Angular ejecuta ANTES que este (los hijos primero). En ese
    // momento las secciones 2-5 aún no están colapsadas por timeLine(), así
    // que su ScrollTrigger queda medido contra un documento más alto de lo
    // que será. Este refresh() lo remide ya con el layout final asentado.
    ScrollTrigger.refresh();

    this.timelineResizeHandler = () => {
      if (this.timelineResizeDebounce) clearTimeout(this.timelineResizeDebounce);
      this.timelineResizeDebounce = setTimeout(() => this.rebuildTimeline(), 200);
    };
    window.addEventListener('resize', this.timelineResizeHandler);
  }

  ngOnDestroy() {
    this.stopTyping();
    this.lenis?.destroy();
    gsap.ticker.remove(this.lenisRaf);

    this.stopParticles();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.timelineResizeHandler) window.removeEventListener('resize', this.timelineResizeHandler);
    if (this.timelineResizeDebounce) clearTimeout(this.timelineResizeDebounce);

    this.scrollTimeline?.scrollTrigger?.kill();
    this.scrollTimeline?.kill();

    this.galleryTween?.kill();
    if (this.galleryKeydownHandler) window.removeEventListener('keydown', this.galleryKeydownHandler);

    this.projectModalTween?.kill();
    if (this.projectModalKeydownHandler) window.removeEventListener('keydown', this.projectModalKeydownHandler);

    this.mediaLightboxTween?.kill();
    if (this.mediaLightboxKeydownHandler) window.removeEventListener('keydown', this.mediaLightboxKeydownHandler);

    this.menuTween?.kill();
    if (this.menuKeydownHandler) window.removeEventListener('keydown', this.menuKeydownHandler);
  }

  private lenisRaf = (time: number) => {
    this.lenis?.raf(time * 1000);
  };

  private initLenis() {
    this.lenis = new Lenis({ lerp: 0.08 });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(this.lenisRaf);
    gsap.ticker.lagSmoothing(0);
  }

  private initParticles() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    this.resizeHandler = resize;
    window.addEventListener('resize', resize);

    const colors = ['#3ec6ff', '#1D4E89', '#0077B6', '#0369a1'];
    const symbols = ['<', '>', '{', '}', '/', '\\', ';', ':', '=', '+', '*', '$', '#', '@', '%', '&', '!', '?', '^', '~'];
    const particles = Array.from({ length: 120 }, () => {
      const size = Math.round(12 + Math.random() * 8);
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)],
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        size,
        font: `${size}px 'Montserrat', monospace`,
        opacity: 0.55 + Math.random() * 0.35,
      };
    }).sort((a, b) => a.size - b.size);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let currentFont = '';
      for (const p of particles) {
        if (p.font !== currentFont) {
          ctx.font = p.font;
          currentFont = p.font;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillText(p.symbol, p.x, p.y);

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20 || p.x > canvas.width + 20) p.vx *= -1;
        if (p.y < -20 || p.y > canvas.height + 20) p.vy *= -1;
      }
      ctx.globalAlpha = 1;
      this.particlesRafId = requestAnimationFrame(draw);
    };

    this.drawParticles = draw;
    draw();

    // Detrás del logo ya no se ve nada, así que no vale la pena seguir
    // dibujando: se para cuando la intro termina de desvanecerse (ver
    // timeLine) y se retoma si el usuario sube de vuelta al inicio.
    this.visibilityHandler = () => {
      if (document.hidden) this.stopParticles();
      else if (this.introVisible) this.startParticles();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopParticles() {
    if (this.particlesRafId !== null) {
      cancelAnimationFrame(this.particlesRafId);
      this.particlesRafId = null;
    }
  }

  private setLogoGradientPaused(paused: boolean) {
    document.getElementById('mask')?.style.setProperty('animation-play-state', paused ? 'paused' : 'running');
  }

  private startParticles() {
    if (this.particlesRafId === null) this.drawParticles?.();
  }

  private startTyping() {
    this.stopTyping();

    this.currentText = '';
    this.isTyping = true;
    this.cdr.detectChanges();

    const progress = { chars: 0 };
    const duration = (this.fullText.length * this.typingSpeed) / 1000;

    this.typingTween = gsap.to(progress, {
      chars: this.fullText.length,
      duration,
      delay: 0.7,
      ease: 'none',
      snap: { chars: 1 },
      onUpdate: () => {
        this.currentText = this.fullText.slice(0, progress.chars);
        this.renderTypedText();
      },
      onComplete: () => this.finishTyping(),
    });
  }

  private finishTyping() {
    this.isTyping = false;
    this.stopTyping();
    this.cdr.detectChanges();

    gsap.fromTo(
      this.introAvatarRef.nativeElement,
      { opacity: 0, scale: 0.4, rotationY: 180, transformPerspective: 600 },
      { opacity: 1, scale: 1, rotationY: 0, duration: 0.9, ease: 'back.out(1.6)' },
    );

    gsap.to(this.introArrowRef.nativeElement, { opacity: 1, duration: 0.6, delay: 0.9 });
  }

  private stopTyping() {
    this.typingTween?.kill();
    this.typingTween = null;
  }

  private renderTypedText() {
    const typedSpan = this.typedTextRef.nativeElement;
    const highlightStart = this.fullText.indexOf(this.highlightText);

    if (highlightStart !== -1 && this.currentText.length > highlightStart) {
      const highlightEnd = highlightStart + this.highlightText.length;
      const safeEnd = Math.min(this.currentText.length, highlightEnd);
      const before = this.currentText.slice(0, highlightStart);
      const highlight = this.currentText.slice(highlightStart, safeEnd);
      const after = this.currentText.slice(safeEnd);

      typedSpan.innerHTML = `${before}<span class='highlight no-shadow' style='color:#3ec6ff;font-weight:700;text-shadow:none;'>${highlight}</span>${after}`;
    } else {
      typedSpan.textContent = this.currentText;
    }
  }

  openGallery() {
    if (this.isGalleryOpen) return;
    this.isGalleryOpen = true;

    const overlay = this.galleryOverlayRef.nativeElement;
    const buttonRect = this.avatarButtonRef.nativeElement.getBoundingClientRect();

    this.galleryTween?.kill();
    gsap.set(overlay, {
      display: 'flex',
      top: buttonRect.top,
      left: buttonRect.left,
      width: buttonRect.width,
      height: buttonRect.height,
      borderRadius: '50%',
      opacity: 1,
    });

    this.galleryTween = gsap.to(overlay, {
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      borderRadius: '0px',
      duration: 0.6,
      ease: 'power3.inOut',
    });

    document.body.style.overflow = 'hidden';
    this.lenis?.stop();

    this.galleryKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeGallery();
      if (event.key === 'ArrowRight') this.nextGalleryImage();
      if (event.key === 'ArrowLeft') this.prevGalleryImage();
    };
    window.addEventListener('keydown', this.galleryKeydownHandler);
  }

  closeGallery() {
    if (!this.isGalleryOpen) return;
    this.isGalleryOpen = false;

    const overlay = this.galleryOverlayRef.nativeElement;
    const buttonRect = this.avatarButtonRef.nativeElement.getBoundingClientRect();

    this.galleryTween?.kill();
    this.galleryTween = gsap.to(overlay, {
      top: buttonRect.top,
      left: buttonRect.left,
      width: buttonRect.width,
      height: buttonRect.height,
      borderRadius: '50%',
      duration: 0.5,
      ease: 'power3.inOut',
      onComplete: () => { gsap.set(overlay, { display: 'none' }); },
    });

    document.body.style.overflow = '';
    this.lenis?.start();

    if (this.galleryKeydownHandler) {
      window.removeEventListener('keydown', this.galleryKeydownHandler);
      this.galleryKeydownHandler = null;
    }
  }

  nextGalleryImage() {
    this.scrollGalleryBy(1);
  }

  prevGalleryImage() {
    this.scrollGalleryBy(-1);
  }

  private scrollGalleryBy(direction: 1 | -1) {
    const track = this.galleryTrackRef.nativeElement;
    track.scrollBy({ left: track.clientWidth * direction, behavior: 'smooth' });
  }

  openProject(project: Project) {
    this.activeProject = project;
    this.cdr.detectChanges();

    const modal = this.projectModalRef.nativeElement;
    this.projectModalTween?.kill();
    gsap.set(modal, { display: 'flex', opacity: 0 });
    gsap.set('.project-modal__content', { opacity: 0, y: 24, scale: 0.97 });

    this.projectModalTween = gsap.timeline()
      .to(modal, { opacity: 1, duration: 0.25, ease: 'power1.out' })
      .to('.project-modal__content', { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' }, '<');

    document.body.style.overflow = 'hidden';
    this.lenis?.stop();

    this.projectModalKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeProject();
    };
    window.addEventListener('keydown', this.projectModalKeydownHandler);
  }

  closeProject() {
    if (!this.activeProject) return;

    const modal = this.projectModalRef.nativeElement;
    this.projectModalTween?.kill();
    this.projectModalTween = gsap.to(modal, {
      opacity: 0,
      duration: 0.25,
      ease: 'power1.in',
      onComplete: () => {
        gsap.set(modal, { display: 'none' });
        this.activeProject = null;
      },
    });

    document.body.style.overflow = '';
    this.lenis?.start();

    if (this.projectModalKeydownHandler) {
      window.removeEventListener('keydown', this.projectModalKeydownHandler);
      this.projectModalKeydownHandler = null;
    }
  }

  openMedia({ media, origin }: MediaOpenEvent) {
    this.mediaLightboxTween?.kill();
    if (this.mediaOrigin) this.mediaOrigin.style.visibility = '';

    this.activeMedia = media;
    this.mediaOrigin = origin;
    this.cdr.detectChanges();

    const lightbox = this.mediaLightboxRef.nativeElement;
    const mediaEl = lightbox.querySelector<HTMLElement>('.media-lightbox__media');
    gsap.set(lightbox, { display: 'flex', opacity: 1 });
    gsap.set('.media-lightbox__backdrop', { opacity: 0 });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.activeMedia === media) lightbox.querySelector('.media-lightbox__backdrop')?.classList.add('media-lightbox__backdrop--blur');
    }));
    gsap.set('.media-lightbox__close', { opacity: 0 });

    const tl = gsap.timeline();
    tl.to('.media-lightbox__backdrop', { opacity: 1, duration: 0.45, ease: 'power1.out' }, 0);

    if (mediaEl) {
      this.sizeLightboxMedia(mediaEl, origin);
      origin.style.visibility = 'hidden';
      tl.fromTo(mediaEl, this.mediaFlipFrom(mediaEl, origin), {
        x: 0,
        y: 0,
        scale: 1,
        clipPath: 'inset(0px 0px 0px 0px)',
        duration: 0.75,
        ease: 'expo.out',
        onComplete: () => { gsap.set(mediaEl, { clearProps: 'clipPath' }); },
      }, 0);
    }

    tl.to('.media-lightbox__close', { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0.4);
    this.mediaLightboxTween = tl;

    document.body.style.overflow = 'hidden';
    this.lenis?.stop();

    this.mediaLightboxKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeMedia();
    };
    window.addEventListener('keydown', this.mediaLightboxKeydownHandler);
  }

  closeMedia() {
    if (!this.activeMedia) return;

    const lightbox = this.mediaLightboxRef.nativeElement;
    const mediaEl = lightbox.querySelector<HTMLElement>('.media-lightbox__media');
    const origin = this.mediaOrigin;

    this.mediaLightboxTween?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        if (origin) origin.style.visibility = '';
        gsap.set(lightbox, { display: 'none' });
        lightbox.querySelector('.media-lightbox__backdrop')?.classList.remove('media-lightbox__backdrop--blur');
        this.activeMedia = null;
        this.mediaOrigin = null;
        this.cdr.detectChanges();
      },
    });

    tl.to('.media-lightbox__close', { opacity: 0, duration: 0.15, ease: 'power1.in' }, 0);

    if (mediaEl && origin?.isConnected) {
      gsap.set(mediaEl, { clipPath: 'inset(0px 0px 0px 0px)' });
      tl.to(mediaEl, { ...this.mediaFlipFrom(mediaEl, origin), duration: 0.55, ease: 'power3.inOut' }, 0);
      tl.to('.media-lightbox__backdrop', { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.1);
    } else {
      tl.to(lightbox, { opacity: 0, duration: 0.25, ease: 'power1.in' }, 0);
    }

    this.mediaLightboxTween = tl;

    document.body.style.overflow = '';
    this.lenis?.start();

    if (this.mediaLightboxKeydownHandler) {
      window.removeEventListener('keydown', this.mediaLightboxKeydownHandler);
      this.mediaLightboxKeydownHandler = null;
    }
  }

  private sizeLightboxMedia(mediaEl: HTMLElement, origin: HTMLElement) {
    const source = origin.querySelector('.shot__media');
    const naturalWidth = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : 0;
    const naturalHeight = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : 0;
    const originRect = origin.getBoundingClientRect();
    const ratio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : originRect.width / originRect.height;

    const lightbox = this.mediaLightboxRef.nativeElement;
    const style = getComputedStyle(lightbox);
    const availableWidth = lightbox.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = lightbox.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    const width = Math.min(availableWidth, availableHeight * ratio, naturalWidth || Infinity);
    gsap.set(mediaEl, { width, height: width / ratio });
  }

  private mediaFlipFrom(mediaEl: HTMLElement, origin: HTMLElement): gsap.TweenVars {
    const o = origin.getBoundingClientRect();
    const final = { left: mediaEl.offsetLeft, top: mediaEl.offsetTop, width: mediaEl.offsetWidth, height: mediaEl.offsetHeight };

    const originRatio = o.width / o.height;
    let cropWidth = final.width;
    let cropHeight = final.height;
    if (final.width / final.height > originRatio) cropWidth = final.height * originRatio;
    else cropHeight = final.width / originRatio;
    const cropX = (final.width - cropWidth) / 2;
    const cropY = (final.height - cropHeight) / 2;
    const scale = o.width / cropWidth;

    return {
      transformOrigin: '0 0',
      x: o.left - final.left - scale * cropX,
      y: o.top - final.top - scale * cropY,
      scale,
      clipPath: `inset(${cropY}px ${cropX}px ${cropY}px ${cropX}px)`,
    };
  }

  toggleMenu() {
    if (this.isMenuOpen) this.closeMenu();
    else this.openMenu();
  }

  openMenu() {
    if (this.isMenuOpen) return;
    this.isMenuOpen = true;

    // El panel arranca con display:none, así que GSAP no puede leer su
    // transform de partida contra una caja que aún no existe: se fija a mano.
    gsap.set('.menu-overlay', { display: 'block', pointerEvents: 'auto' });
    gsap.set('.menu-panel', { xPercent: 100, x: 0 });

    this.menuTween?.kill();
    this.menuTween = gsap.timeline()
      .to('.menu-overlay', { opacity: 1, duration: 0.3, ease: 'power1.out' })
      .to('.menu-panel', { xPercent: 0, duration: 0.4, ease: 'power3.out' }, '<');

    document.body.style.overflow = 'hidden';
    this.lenis?.stop();

    this.menuKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeMenu();
    };
    window.addEventListener('keydown', this.menuKeydownHandler);
  }

  closeMenu() {
    if (!this.isMenuOpen) return;
    this.isMenuOpen = false;

    this.menuTween?.kill();
    this.menuTween = gsap.timeline()
      .to('.menu-panel', { xPercent: 100, duration: 0.35, ease: 'power2.in' })
      .to('.menu-overlay', {
        opacity: 0,
        duration: 0.25,
        ease: 'power1.in',
        onComplete: () => { gsap.set('.menu-overlay', { display: 'none', pointerEvents: 'none' }); },
      }, '<+=0.1');

    document.body.style.overflow = '';
    this.lenis?.start();

    if (this.menuKeydownHandler) {
      window.removeEventListener('keydown', this.menuKeydownHandler);
      this.menuKeydownHandler = null;
    }
  }

  goToTop() {
    this.closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToElement(id: string) {
    this.closeMenu();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Sections 2-5 son position:fixed durante todo el pin, no tienen posición
  // propia en el documento: para "ir" a una hay que traducir su label del
  // timeline al scrollY que le corresponde.
  goToLabel(label: string) {
    this.closeMenu();

    const tl = this.scrollTimeline;
    const st = tl?.scrollTrigger;
    if (!tl || !st) return;

    const labelTime = tl.labels[label];
    if (labelTime === undefined) return;

    const progress = labelTime / tl.duration();
    const targetY = st.start + progress * (st.end - st.start);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  private rebuildTimeline() {
    this.scrollTimeline?.scrollTrigger?.kill();
    this.scrollTimeline?.kill();

    // kill() deja los valores del último frame puestos; hay que limpiarlos
    // antes de que timeLine() vuelva a medir el DOM o las medidas salen mal.
    gsap.set(
      ['#section-2', '#section-3', '#section-4', '.section-4__list', '#section-5', '.section-5__track', '.section-5__header', '.avatar-button', '.menu-toggle'],
      { clearProps: 'all' },
    );

    this.timeLine();
    ScrollTrigger.refresh();
  }

  private timeLine() {
    gsap.set('.avatar-button', { opacity: 0, pointerEvents: 'none' });
    gsap.set('.menu-toggle', { opacity: 0, pointerEvents: 'none' });

    gsap.set('#section-2', { maskSize: '0vmax 0vmax', xPercent: -50, yPercent: -50, visibility: 'hidden' });
    gsap.set('#section-3', { maskSize: '0vmax 0vmax', xPercent: -50, yPercent: -50, visibility: 'hidden' });
    gsap.set('#section-4', { opacity: 0, y: '100vh', '--edge-fade': 0 });
    gsap.set('#section-5', { opacity: 0, y: '100vh' });
    gsap.set('.section-5__header', { y: '40px', opacity: 0 });

    const section4ContentTravel = this.measureSection4Travel();
    gsap.set('.section-4__list', { y: section4ContentTravel });

    // Hay que medir el carrusel en reposo, antes de aplicar el xPercent:25
    // inicial (si no, la medida saldría desplazada por ese mismo transform).
    const { endXPercent: section5TrackEndXPercent, duration: section5TrackDuration } = this.measureSection5Track();
    gsap.set('.section-5__track', { xPercent: 25 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.app-container',
        start: 'top top',
        end: '+=5000',
        pin: true,
        // 'fixed' en vez del transform por defecto de GSAP: evita que
        // .app-container haga de containing block de los fixed internos,
        // y va más fino en móvil con el resize de la barra de direcciones.
        pinType: 'fixed',
        scrub: 1,
      },
    });
    this.scrollTimeline = tl;

    tl
      .to('#mask', { maskSize: 'clamp(10dvh, 15%, 15vh)', ease: 'power2.out', duration: 2.2 })

      .to('#introduction', {
        opacity: 0,
        ease: 'power2.out',
        duration: 2.2,
        onStart: () => this.setLogoGradientPaused(false),
        onComplete: () => {
          this.introVisible = false;
          this.stopParticles();
        },
        onReverseComplete: () => {
          this.introVisible = true;
          this.startParticles();
          this.setLogoGradientPaused(true);
        },
      }, '<0.6')

      .to('#section-2', { maskSize: INTRO_TEXT_MASK_OPEN, opacity: 1, visibility: 'visible', ease: 'power2.out', duration: 1.1 }, '>-1.2')
      .addLabel('section2Start', '<')
      .fromTo('#section-2', { scale: 1.25 / INTRO_TEXT_SCALE }, { scale: 1, ease: 'none', duration: 1.6 }, 'section2Start')
      // Verde → cian → morado, solo mientras el texto se ve opaco: arranca con
      // la máscara ya casi abierta y termina cuando el fade de salida empieza
      // a notarse. Si no, el primer y el último color pasan semitransparentes.
      .to('#section-2', { backgroundPosition: '100% 50%', ease: 'none', duration: INTRO_COLOR_DURATION }, `section2Start+=${INTRO_COLOR_DELAY}`)
      .to('#section-2', { maskSize: '0vmax 0vmax', opacity: 0, ease: 'power2.in', duration: 0.8 }, 'section2Start+=0.65')

      .to('#section-3', { maskSize: INTRO_TEXT_MASK_OPEN, opacity: 1, visibility: 'visible', ease: 'power2.out', duration: 1.1 }, '>')
      .addLabel('section3Start', '<')
      .fromTo('#section-3', { scale: 1.25 / INTRO_TEXT_SCALE }, { scale: 1, ease: 'none', duration: 1.6 }, 'section3Start')
      // Morado → cian → verde, con el mismo tramo opaco que la sección 2.
      .to('#section-3', { backgroundPosition: '0% 50%', ease: 'none', duration: INTRO_COLOR_DURATION }, `section3Start+=${INTRO_COLOR_DELAY}`)
      .to('#section-3', { maskSize: '0vmax 0vmax', opacity: 0, ease: 'power2.in', duration: 0.8 }, 'section3Start+=0.65')

      .to('#section-4', { opacity: 1, y: '0vh', ease: 'power2.out', duration: 1.2 }, '<+=0.55')
      .addLabel('s4Settled')
      .to('.section-4__list', { y: -section4ContentTravel, ease: 'none', duration: 3 }, 's4Settled-=0.9')
      .addLabel('s4ContentDone')
      // El degradado de borde solo se ve con el panel asentado, nunca
      // mientras entra o sale (si no, queda una línea flotando encima).
      .to('#section-4', { '--edge-fade': 1, duration: 0.3 }, 's4Settled')
      .to('#section-4', { '--edge-fade': 0, duration: 0.3 }, 's4ContentDone-=1.3')
      .to('#section-4', { opacity: 0, y: '-100vh', ease: 'power2.in', duration: 1.2 }, 's4ContentDone-=1.2')

      .to('#section-5', { opacity: 1, y: '0vh', ease: 'power2.out', duration: 0.9 }, '>-0.6')
      .addLabel('s5Opaque')
      .to('.section-5__header', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.5 }, 's5Opaque-=0.9')
      .to('.section-5__track', { xPercent: section5TrackEndXPercent, ease: 'none', duration: section5TrackDuration }, 's5Opaque-=0.9')

      .to('.avatar-button', { opacity: 1, pointerEvents: 'auto', ease: 'power1.out', duration: 0.4 }, 'section2Start')
      .to('.menu-toggle', { opacity: 1, pointerEvents: 'auto', ease: 'power1.out', duration: 0.4 }, '<');
  }

  // Recorrido en px de la lista de "Why me?": (alto de la ventana + alto de
  // la lista) / 2, para que entre por abajo y salga por arriba sin tiempo
  // muerto sea cual sea su longitud. .section-4__content es la ventana real
  // (en móvil es más baja que el 100vh de la sección, porque el título se
  // queda con parte del alto).
  private measureSection4Travel(): number {
    const window_ = document.querySelector('.section-4__content');
    const list = document.querySelector('.section-4__list');
    if (!window_ || !list) return 0;
    return (window_.getBoundingClientRect().height + list.getBoundingClientRect().height) / 2;
  }

  // Calcula dónde debe terminar el carrusel de skills (para que el borde de
  // la última tarjeta llegue justo al borde del viewport, sin hueco vacío)
  // y cuánto debe durar el recorrido (más lento cuantas menos tarjetas
  // quepan a la vez en pantalla, para que no pasen demasiado rápido en móvil).
  private measureSection5Track(): { endXPercent: number; duration: number } {
    const track = document.querySelector('.section-5__track');
    const viewport = document.querySelector('.section-5__viewport');
    const firstCard = document.querySelector('.section-5__card');
    const lastCard = document.querySelector('.section-5__card:last-child');
    if (!track || !viewport || !firstCard || !lastCard) return { endXPercent: 0, duration: 2 };

    const trackWidth = track.getBoundingClientRect().width;
    const viewportRect = viewport.getBoundingClientRect();
    const viewportStyle = getComputedStyle(viewport);
    const paddingLeft = parseFloat(viewportStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(viewportStyle.paddingRight) || 0;

    const usableRight = viewportRect.right - paddingRight;
    const lastCardRight = lastCard.getBoundingClientRect().right;
    const endXPercent = ((usableRight - lastCardRight) / trackWidth) * 100;

    const usableWidth = viewportRect.width - paddingLeft - paddingRight;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const cardsPerScreen = cardWidth > 0 ? usableWidth / cardWidth : 1;
    const referenceCardsPerScreen = 4.65; // calibrado en desktop (~1440px)
    const duration = 2 * Math.sqrt(referenceCardsPerScreen / Math.max(cardsPerScreen, 0.5));

    return { endXPercent, duration };
  }
}
