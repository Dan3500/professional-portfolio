# Análisis del proyecto — professional-portfolio

Notas de exploración para entender el estado actual del repo (generado el 2026-07-27).

## Stack

- **Angular 21** (standalone components, sin NgModules), generado con Angular CLI.
- **Bundler/builder**: `@angular/build:application` (esbuild-based), config en [angular.json](angular.json).
- **Animaciones**: [GSAP](https://gsap.com/) 3.14 + plugin `ScrollTrigger`.
- **Scroll suave**: [Lenis](https://lenis.darkroom.engineering/) 1.3.
- **Estilos**: SCSS con variables propias (colores, fuente) en [src/styles.scss](src/styles.scss).
- **Tests**: Vitest + jsdom, vía el test runner nuevo de Angular (`ng test` → `@angular/build:unit-test`).
- **Fuentes propias**: Montserrat (variable + estáticas) y una familia "gta-*" (woff) en `public/assets/fonts`.

No hay `package.json` scripts fuera de los estándar de Angular CLI (`start`, `build`, `watch`, `test`).

## Estructura

```
src/
  app/
    app.ts / app.html / app.scss   → componente raíz, solo <router-outlet>
    app.config.ts                  → providers: router + error listeners globales
    app.routes.ts                  → única ruta activa: '' → pages/index/Index
    home/                          → componente NO USADO (ver "Código muerto")
    pages/index/                   → única página real de la app (home del portfolio)
    shared/                        → carpeta vacía (preparada para componentes compartidos)
  styles.scss                      → variables SCSS globales + @font-face + reset scrollbar
public/assets/
  img/    → logos/fondos, incluye assets temáticos de "GTA VI" (ver abajo)
  fonts/  → Montserrat + fuentes "gta-*"
```

## La página principal (`pages/index`)

[index.ts](src/app/pages/index/index.ts) es el único componente con lógica real:

- Efecto de **texto tipeado** ("Hello! I'm Daniel Soltero") usando un tween de GSAP sobre un contador de caracteres, con el nombre resaltado en color primario.
- Un **canvas de partículas** (`#particlesCanvas`) dibujado a mano con `requestAnimationFrame`: símbolos de código (`< > { } ( ) ...`) flotando con velocidad y color aleatorios.
- **Lenis** inicializado a mano y sincronizado con el ticker de GSAP (`gsap.ticker.add` + `ScrollTrigger.update` en el evento `scroll`).
- Un **timeline de GSAP con ScrollTrigger pineado** (`.app-container`, `end: '+=5000'`, `scrub: 1`) que orquesta 5 secciones como una experiencia de scroll-storytelling:
  1. `#introduction` — texto tipeado + canvas de partículas.
  2. `#section-2` — "Who I am", texto con máscara circular + gradiente animado vía custom properties CSS (`--sec2-c1/2/3`).
  3. `#section-3` — mismo patrón que la 2 (placeholder "Section 3", Lorem ipsum).
  4. `#section-4` — "Why me?", lista de bullets, con título fijo y contenido que se desplaza verticalmente.
  5. `#section-5` — "Selected work", carrusel horizontal de 10 tarjetas (`section-5__track` se mueve con `xPercent`).
- Un `#mask` fijo con `mask-image: url(.../logo-vi.svg)` que se expande sobre toda la intro — máscara con forma de logo, con degradado animado de fondo (`gradient-shift`).

Los estilos viven en [index.scss](src/app/pages/index/index.scss) y usan las variables de `styles.scss` vía `@use '../../../styles.scss' as *`.

## Código muerto / restos de prototipo

- **`app/home/`** (`HomeComponent`) no está enrutado — la ruta está comentada en [app.routes.ts](src/app/app.routes.ts:5-8). Es un prototipo previo con temática **GTA VI** explícita: IDs como `#logo-gta-vi`, `#texto-3` con texto sobre "Grand Theft Auto VI", `markers: true` en un ScrollTrigger (debug visual activo), y estilos con `border: 1px solid red/yellow` (debug). Puede borrarse si ya no se necesita como referencia.
- Los assets `logo-gta-mask.svg`, `full-logo.webp` y las fuentes `gta-*.woff` en `public/assets` solo los usa este componente muerto — si se elimina `home/`, también se pueden limpiar esos assets.
- **`src/app/app.scss`** está vacío.
- **`src/app/shared/`** está vacía, sin archivos.
- El contenido de `index.html` (secciones 2, 3, 4) es todavía **Lorem ipsum** / placeholders ("Section 3", lista de bullets repetida dos veces literalmente) — contenido real del portfolio aún por escribir.

## Puntos a tener en cuenta

- Toda la lógica de animación vive en un único componente (`Index`) con manipulación directa del DOM vía selectores de ID/clase para GSAP — no hay separación en subcomponentes por sección todavía.
- `index.spec.ts` solo comprueba que el componente se crea (test por defecto del CLI, sin cobertura real).
- El proyecto parece pensado para crecer con más secciones/proyectos reales en `section-5__track`, reemplazando los datos de ejemplo.
