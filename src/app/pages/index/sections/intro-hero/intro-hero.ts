import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { gsap } from 'gsap';
import { escapeHtml, waveChars } from '../../../../shared/text-effects';

// Portada: logo en máscara (#mask, que el timeline de Index encoge con el
// scroll), fondo de luces, partículas de código, el nombre escribiéndose con
// su ola de color, el rol y la foto. Index la oculta/recupera con hide()/show()
// cuando la intro termina de desvanecerse o se vuelve a ella.
@Component({
  selector: 'app-intro-hero',
  templateUrl: './intro-hero.html',
  styleUrls: ['./intro-hero.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroHero implements AfterViewInit, OnDestroy {
  @ViewChild('particlesCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('typedText', { static: true }) typedTextRef!: ElementRef<HTMLSpanElement>;
  @ViewChild('typedGhost', { static: true }) typedGhostRef!: ElementRef<HTMLSpanElement>;
  @ViewChild('introAvatar', { static: true }) introAvatarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('introArrow', { static: true }) introArrowRef!: ElementRef<HTMLSpanElement>;
  @ViewChild('introRole', { static: true }) introRoleRef!: ElementRef<HTMLParagraphElement>;
  @ViewChild('mask', { static: true }) maskRef!: ElementRef<HTMLDivElement>;
  @ViewChild('introduction', { static: true }) introductionRef!: ElementRef<HTMLElement>;

  // Escritura
  private readonly fullText = "Hello! I'm\nDaniel Soltero";
  private readonly typingSpeed = 60;
  private readonly highlightText = 'Daniel Soltero';
  private currentText = '';
  // Sentido de la ola de color del nombre, al azar como el de los títulos.
  private readonly heroWaveReverse = Math.random() < 0.5;
  private typingTween: gsap.core.Tween | null = null;

  // Partículas
  private resizeHandler: (() => void) | null = null;
  private pointerHandler: ((event: PointerEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private particlesRafId: number | null = null;
  private drawParticles: (() => void) | null = null;

  // "Reducir movimiento" del sistema: partículas quietas (y en el CSS, sin
  // bucles decorativos).
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private isVisible = true;

  // Mientras se ve: pushWaves (Index) solo mueve la ola del nombre entonces.
  get visible() {
    return this.isVisible;
  }

  ngAfterViewInit() {
    this.renderTypedGhost();
    this.startTyping();
    this.initParticles();
    this.placeAuroraBlobs();
  }

  ngOnDestroy() {
    this.stopTyping();
    this.stopParticles();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.pointerHandler) window.removeEventListener('pointermove', this.pointerHandler);
  }

  // La intro ya se ha desvanecido detrás del logo: no tiene sentido seguir
  // dibujando partículas ni animando nada de ella (manchas, cursor, anillo del
  // avatar, flecha).
  hide() {
    this.isVisible = false;
    this.stopParticles();
    this.introductionRef.nativeElement.classList.add('intro-section--paused');
  }

  // Se ha vuelto a la intro: se retoma todo y el degradado del logo se para.
  show() {
    this.isVisible = true;
    this.startParticles();
    this.introductionRef.nativeElement.classList.remove('intro-section--paused');
    this.setLogoGradientRunning(false);
  }

  // El degradado del logo solo se anima una vez la portada empieza a
  // encogerse dentro de él.
  setLogoGradientRunning(running: boolean) {
    this.maskRef.nativeElement.classList.toggle('mask--gradient-running', running);
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

    // Pocos símbolos en tres capas de profundidad: los del fondo pequeños,
    // tenues y lentos; los de delante más grandes y vivos. Con el ratón se
    // desplazan más cuanto más cerca están (parallax).
    const colors = ['#ffffff', '#ffffff', '#34d399', '#22d3ee', '#a5b4fc'];
    const symbols = ['<', '>', '{', '}', '/', '\\', ';', ':', '=', '+', '*', '$', '#', '@', '%', '&', '!', '?', '^', '~'];
    const layers = [
      { count: 22, size: 11, opacity: 0.18, speed: 0.12, parallax: 6 },
      { count: 14, size: 15, opacity: 0.3, speed: 0.2, parallax: 14 },
      { count: 7, size: 21, opacity: 0.45, speed: 0.3, parallax: 26 },
    ];
    const particles = layers.flatMap((layer) =>
      Array.from({ length: layer.count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * layer.speed * 2,
        vy: (Math.random() - 0.5) * layer.speed * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        font: `${layer.size}px 'Montserrat', monospace`,
        opacity: layer.opacity,
        parallax: layer.parallax,
      })),
    );

    // Posición del ratón en -1..1 respecto al centro, suavizada con un lerp.
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.pointerHandler = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    if (!this.reduceMotion) window.addEventListener('pointermove', this.pointerHandler, { passive: true });

    // Cada combinación de símbolo, color y tamaño se dibuja una sola vez en un
    // canvas pequeño; en cada fotograma solo se copia con drawImage, mucho más
    // barato que volver a dibujar el texto con fillText.
    const sprites = new Map<string, HTMLCanvasElement>();
    const sprite = (p: (typeof particles)[number]) => {
      const key = `${p.symbol}|${p.color}|${p.font}`;
      let image = sprites.get(key);
      if (!image) {
        const size = parseInt(p.font, 10);
        image = document.createElement('canvas');
        image.width = image.height = size * 2;
        const spriteCtx = image.getContext('2d')!;
        spriteCtx.font = p.font;
        spriteCtx.fillStyle = p.color;
        spriteCtx.textAlign = 'center';
        spriteCtx.textBaseline = 'middle';
        spriteCtx.fillText(p.symbol, size, size);
        sprites.set(key, image);
      }
      return image;
    };
    // Si se dibujaron antes de cargar Montserrat, se regeneran con ella.
    document.fonts?.ready.then(() => sprites.clear());

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;

      for (const p of particles) {
        const image = sprite(p);
        ctx.globalAlpha = p.opacity;
        ctx.drawImage(
          image,
          Math.round(p.x - pointer.x * p.parallax - image.width / 2),
          Math.round(p.y - pointer.y * p.parallax - image.height / 2),
        );

        if (this.reduceMotion) continue;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -40 || p.x > canvas.width + 40) p.vx *= -1;
        if (p.y < -40 || p.y > canvas.height + 40) p.vy *= -1;
      }
      ctx.globalAlpha = 1;
      // Con "reducir movimiento" se dibujan una sola vez, quietas.
      if (!this.reduceMotion) this.particlesRafId = requestAnimationFrame(draw);
    };

    this.drawParticles = draw;
    draw();

    // Detrás del logo ya no se ve nada, así que no vale la pena seguir
    // dibujando: se para cuando la intro termina de desvanecerse (ver
    // timeLine) y se retoma si el usuario sube de vuelta al inicio.
    this.visibilityHandler = () => {
      if (document.hidden) this.stopParticles();
      else if (this.isVisible) this.startParticles();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopParticles() {
    if (this.particlesRafId !== null) {
      cancelAnimationFrame(this.particlesRafId);
      this.particlesRafId = null;
    }
  }

  private startParticles() {
    if (this.particlesRafId === null) this.drawParticles?.();
  }

  // Coloca las manchas de luz de la portada al azar en cada carga, sin que se
  // amontonen: cada una cae en una franja vertical distinta de la pantalla
  // (asignadas al azar) y en un punto aleatorio dentro de ella.
  private placeAuroraBlobs() {
    const blobs = Array.from(document.querySelectorAll<HTMLElement>('.intro-aurora__blob'));
    const columns = blobs.map((_, i) => i).sort(() => Math.random() - 0.5);
    blobs.forEach((blob, i) => {
      const columnWidth = 100 / blobs.length;
      const cx = (columns[i] + Math.random()) * columnWidth;
      const cy = Math.random() * 100;
      blob.style.setProperty('--blob-cx', `${cx.toFixed(1)}%`);
      blob.style.setProperty('--blob-cy', `${cy.toFixed(1)}%`);
    });
  }

  private startTyping() {
    this.stopTyping();

    this.currentText = '';
    this.renderTypedText(); // el cursor parpadea ya antes de empezar a escribir

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
    this.stopTyping();

    gsap.fromTo(
      this.introAvatarRef.nativeElement,
      { opacity: 0, scale: 0.4, rotationY: 180, transformPerspective: 600 },
      { opacity: 1, scale: 1, rotationY: 0, duration: 0.9, ease: 'back.out(1.6)' },
    );

    gsap.fromTo(this.introRoleRef.nativeElement, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.3, ease: 'power2.out' });
    gsap.to(this.introArrowRef.nativeElement, { opacity: 1, duration: 0.6, delay: 0.9 });
  }

  private stopTyping() {
    this.typingTween?.kill();
    this.typingTween = null;
  }

  // La copia invisible que reserva el hueco del título, con la misma estructura
  // que el texto que se escribe (letras sueltas y el cursor dentro de la última
  // palabra): como texto normal, con su ajuste entre letras, ocupaba unos
  // píxeles menos y el nombre visible podía partirse en dos líneas.
  private renderTypedGhost() {
    const highlightStart = this.fullText.indexOf(this.highlightText);
    const cursor = '<span class="cursor cursor--ghost">|</span>';
    this.typedGhostRef.nativeElement.innerHTML =
      escapeHtml(this.fullText.slice(0, highlightStart)) +
      `<span class="highlight">${waveChars(this.highlightText, false, undefined, cursor)}</span>`;
  }

  // Pinta lo escrito hasta ahora con el cursor pegado a la última letra: en
  // "Hello! I'm" va detrás del texto (con su tamaño) y en el nombre, dentro de
  // su última palabra, con el tamaño grande y sin poder quedarse solo en otra
  // línea.
  private renderTypedText() {
    const typedSpan = this.typedTextRef.nativeElement;
    const cursor = '<span class="cursor">|</span>';
    const highlightStart = this.fullText.indexOf(this.highlightText);

    if (highlightStart !== -1 && this.currentText.length > highlightStart) {
      const highlightEnd = highlightStart + this.highlightText.length;
      const safeEnd = Math.min(this.currentText.length, highlightEnd);
      const before = this.currentText.slice(0, highlightStart);
      const highlight = this.currentText.slice(highlightStart, safeEnd);

      const letters = waveChars(highlight, this.heroWaveReverse, this.highlightText.length, cursor);
      typedSpan.innerHTML = `${escapeHtml(before)}<span class="highlight">${letters}</span>`;
    } else {
      typedSpan.innerHTML = escapeHtml(this.currentText) + cursor;
    }
  }
}
