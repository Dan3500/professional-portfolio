// Scrub de vídeo ligado al scroll sin re-codificar nada.
//
// Los mp4 del proyecto tienen 1-2 keyframes en todo el clip, así que mover
// video.currentTime con el scroll obliga al navegador a decodificar desde el
// keyframe en CADA seek (tirones de cientos de ms, sobre todo en Safari). En
// su lugar, cada vídeo se reproduce UNA vez, en silencio y fuera de pantalla,
// y se van guardando sus fotogramas como JPEG en memoria (~10-15 MB por
// vídeo). Después se pintan en un <canvas> según el progreso del scroll,
// decodificando bajo demanda y con una caché LRU pequeña de ImageBitmap para
// no disparar la memoria.

const TARGET_FPS = 24;
const MAX_FRAMES = 150;
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.82;
const DECODED_CACHE_SIZE = 12;

export class VideoFrames {
  private frames: (Blob | undefined)[] = [];
  private cache = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private disposed = false;
  private extraction: Promise<void> | null = null;

  constructor(readonly src: string) {}

  get count(): number {
    return this.frames.length;
  }

  // Idempotente: la primera llamada arranca la extracción, el resto
  // reutilizan la misma promesa.
  extract(): Promise<void> {
    this.extraction ??= this.runExtraction();
    return this.extraction;
  }

  // Devuelve el fotograma `index` si ya está decodificado; si no, lanza su
  // decodificación y devuelve el más cercano que haya en caché (o nada).
  bitmap(index: number): { bitmap: ImageBitmap; exact: boolean } | undefined {
    const hit = this.cache.get(index);
    if (hit) {
      this.cache.delete(index);
      this.cache.set(index, hit); // refresca su posición en el LRU
      return { bitmap: hit, exact: true };
    }

    this.decode(index);

    let nearest: ImageBitmap | undefined;
    let bestDistance = Infinity;
    for (const [i, bmp] of this.cache) {
      const distance = Math.abs(i - index);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = bmp;
      }
    }
    return nearest ? { bitmap: nearest, exact: false } : undefined;
  }

  // Precarga vecinos para que al seguir haciendo scroll el siguiente ya esté.
  prefetch(index: number, direction: number) {
    this.decode(index + (direction >= 0 ? 1 : -1));
  }

  dispose() {
    this.disposed = true;
    for (const bmp of this.cache.values()) bmp.close();
    this.cache.clear();
    this.frames = [];
  }

  private decode(index: number) {
    const blob = this.frames[index];
    if (!blob || this.cache.has(index) || this.decoding.has(index)) return;

    this.decoding.add(index);
    createImageBitmap(blob)
      .then((bmp) => {
        this.decoding.delete(index);
        if (this.disposed) {
          bmp.close();
          return;
        }
        this.cache.set(index, bmp);
        while (this.cache.size > DECODED_CACHE_SIZE) {
          const oldest = this.cache.keys().next().value as number;
          this.cache.get(oldest)?.close();
          this.cache.delete(oldest);
        }
      })
      .catch(() => this.decoding.delete(index));
  }

  private async runExtraction() {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'auto';
    // Tiene que estar en el DOM para que el navegador presente fotogramas;
    // 2px e invisible para no afectar al layout.
    Object.assign(video.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '2px',
      height: '2px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    video.src = this.src;
    document.body.appendChild(video);

    try {
      await once(video, 'loadedmetadata');
      if (this.disposed) return;

      const total = Math.max(2, Math.min(MAX_FRAMES, Math.round(video.duration * TARGET_FPS)));
      this.frames = new Array(total);

      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const encoder = FrameEncoder.get();
      const encodes: Promise<void>[] = [];
      const pending = new Set<number>();
      const capture = (time: number) => {
        const slot = Math.min(total - 1, Math.floor((time / video.duration) * total));
        if (this.disposed || this.frames[slot] || pending.has(slot)) return;
        pending.add(slot);

        if (encoder) {
          encodes.push(
            createImageBitmap(video, { resizeWidth: canvas.width, resizeHeight: canvas.height, resizeQuality: 'low' })
              .then((bitmap) => encoder.encode(bitmap, JPEG_QUALITY))
              .then((blob) => {
                if (blob && !this.disposed) this.frames[slot] = blob;
              })
              .catch(() => {}),
          );
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // toBlob copia el bitmap en el momento de la llamada, así que se
        // puede reutilizar el mismo canvas para el siguiente fotograma.
        encodes.push(
          new Promise((resolve) =>
            canvas.toBlob(
              (blob) => {
                if (blob && !this.disposed) this.frames[slot] = blob;
                resolve();
              },
              'image/jpeg',
              JPEG_QUALITY,
            ),
          ),
        );
      };

      try {
        await this.captureByPlayback(video, capture);
      } catch {
        // play() rechazado (p. ej. modo de bajo consumo en iOS): se cae a
        // seeks secuenciales, más lento pero no depende del autoplay.
        await this.captureBySeeking(video, total, capture);
      }

      await Promise.all(encodes);
      this.fillGaps();
    } finally {
      video.removeAttribute('src');
      video.load();
      video.remove();
    }
  }

  private captureByPlayback(video: HTMLVideoElement, capture: (time: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let rafId = 0;
      const hasFrameCallback = 'requestVideoFrameCallback' in video;

      const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
        capture(meta.mediaTime);
        if (!video.ended) video.requestVideoFrameCallback(onFrame);
      };
      const poll = () => {
        capture(video.currentTime);
        if (!video.ended) rafId = requestAnimationFrame(poll);
      };

      // Con la pestaña en segundo plano el navegador pausa el vídeo; se
      // retoma al volver (los huecos que queden los rellena fillGaps()).
      const onVisibility = () => {
        if (!document.hidden && !video.ended && video.paused) video.play().catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisibility);

      video.addEventListener(
        'ended',
        () => {
          cancelAnimationFrame(rafId);
          document.removeEventListener('visibilitychange', onVisibility);
          resolve();
        },
        { once: true },
      );

      video
        .play()
        .then(() => {
          if (hasFrameCallback) video.requestVideoFrameCallback(onFrame);
          else poll();
        })
        .catch((error) => {
          document.removeEventListener('visibilitychange', onVisibility);
          reject(error);
        });
    });
  }

  private async captureBySeeking(video: HTMLVideoElement, total: number, capture: (time: number) => void) {
    for (let i = 0; i < total && !this.disposed; i++) {
      const time = ((i + 0.5) / total) * video.duration;
      video.currentTime = time;
      await once(video, 'seeked');
      capture(time);
    }
  }

  // Si durante la reproducción se saltó algún fotograma, se rellena con el
  // vecino más cercano para que el scrub nunca se quede en blanco.
  private fillGaps() {
    let last: Blob | undefined;
    for (let i = 0; i < this.frames.length; i++) {
      if (this.frames[i]) last = this.frames[i];
      else this.frames[i] = last;
    }
    let next: Blob | undefined;
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (this.frames[i]) next = this.frames[i];
      else this.frames[i] = next;
    }
  }
}

// Pinta en un <canvas> (object-fit: cover) el fotograma que toca según el
// progreso 0-1 que le pasa el ScrollTrigger, suavizado con un lerp.
export class ScrubCanvas {
  private target = 0;
  private current = 0;
  private lastDrawn = -1;
  private ctx: CanvasRenderingContext2D | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly frames: VideoFrames,
  ) {
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  setProgress(progress: number) {
    this.target = progress;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.lastDrawn = -1;
  }

  tick() {
    const count = this.frames.count;
    if (!this.ctx || count === 0) return;

    this.current += (this.target - this.current) * 0.15;
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;

    const index = Math.round(this.current * (count - 1));
    if (index === this.lastDrawn) return;

    const frame = this.frames.bitmap(index);
    if (!frame) return;

    this.draw(frame.bitmap);
    // Si se pintó un vecino mientras el exacto se decodifica, se reintenta
    // en el siguiente tick.
    if (frame.exact) {
      this.frames.prefetch(index, this.target - this.current);
      this.lastDrawn = index;
    }
  }

  private draw(bitmap: ImageBitmap) {
    const { width: cw, height: ch } = this.canvas;
    const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
    // Coordenadas enteras: con medio píxel el borde se mezclaría con el
    // fotograma anterior.
    const x = Math.floor((cw - bitmap.width * scale) / 2);
    const y = Math.floor((ch - bitmap.height * scale) / 2);
    this.ctx!.drawImage(bitmap, x, y, cw - 2 * x, ch - 2 * y);
  }
}

class FrameEncoder {
  private static instance: FrameEncoder | null | undefined;
  private nextId = 0;
  private pending = new Map<number, (blob: Blob | null) => void>();

  private constructor(private readonly worker: Worker) {
    worker.onmessage = ({ data }: MessageEvent<{ id: number; blob: Blob | null }>) => {
      this.pending.get(data.id)?.(data.blob);
      this.pending.delete(data.id);
    };
  }

  static get(): FrameEncoder | null {
    if (FrameEncoder.instance === undefined) {
      try {
        FrameEncoder.instance = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
          ? new FrameEncoder(new Worker(new URL('./frame-encoder.worker', import.meta.url), { type: 'module' }))
          : null;
      } catch {
        FrameEncoder.instance = null;
      }
    }
    return FrameEncoder.instance;
  }

  encode(bitmap: ImageBitmap, quality: number): Promise<Blob | null> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, bitmap, quality }, [bitmap]);
    });
  }
}

function once(target: EventTarget, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = () => reject(new Error(`Error cargando vídeo (${type})`));
    target.addEventListener(type, () => {
      target.removeEventListener('error', onError);
      resolve();
    }, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}
