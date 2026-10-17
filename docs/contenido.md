# Dónde se edita el contenido

Guía rápida para cambiar textos, vídeos e imágenes del portfolio.

Todos los archivos estáticos van dentro de `public/`. En el código se escriben sin ese prefijo: `public/assets/img/foto.jpg` se pone como `assets/img/foto.jpg`.

---

## Proyectos (vídeos, imágenes y textos)

**Archivo:** `src/app/pages/index/project-stories.data.ts`

| Qué      | Carpeta                          | Formato |
|----------|----------------------------------|---------|
| Vídeos   | `public/assets/video/projects/`  | `.mp4`  |
| Imágenes | `public/assets/img/projects/`    | `.jpg`  |

Cada proyecto es un bloque `{ ... }` dentro de `PROJECTS`. En la web se ve como dos pantallas seguidas:

1. **Presentación**
   - `titulo`, `subtitulo` y `descripcion`.
   - `videoPortada`: vídeo de fondo que avanza con el scroll.
   - `galeria`: fotos y vídeos pequeños alrededor.
2. **Cita**
   - `quote`: la frase grande.
   - `mediaQuote`: fondo (vídeo o imagen).
   - `subtituloQuote` y `descripcionQuote` (opcionales).
   - `galeriaQuote`: segunda galería.

Los archivos se indican solo por el nombre, sin carpeta ni extensión:

```ts
videoPortada: video('mi-proyecto-hero'),                        // → public/assets/video/projects/mi-proyecto-hero.mp4
galeria: [image('mi-proyecto-1'), video('mi-proyecto-demo')],   // en las galerías se pueden mezclar
```

- `image()` solo busca archivos `.jpg`. Si tienes PNG o WebP, conviértelos a JPG o cambia la extensión en la función `image` del mismo archivo.
- Para añadir un proyecto, copia un bloque `{ ... }` y cambia sus datos. Para quitarlo, borra su bloque.

### Recomendaciones para los vídeos

- **Duración:** como mucho unos 6 segundos. El scroll usa un máximo de 150 fotogramas a 24 por segundo, así que en un vídeo más largo el movimiento sale más a saltos.
- **Ancho:** 1280 px basta, porque se reduce a eso de todas formas.
- **Formato:** MP4 en H.264, sin audio, que no se usa.
- **Peso:** cuanto menos pese, antes se prepara el vídeo para el scroll.

### Situación actual

- Los tres proyectos (E-commerce, SaaS y Banking) son de relleno, y sus galerías repiten imágenes de un proyecto a otro.
- `saas-secondary.mp4` es idéntico a `banking-hero.mp4`, por eso no se usa. Cuando tengas el vídeo real del SaaS, sustituye ese archivo y úsalo en el proyecto SaaS.
- Cuando metas los archivos reales, borra los de prueba que dejen de usarse para no subirlos a la web.

---

## Foto de perfil

**Archivo:** `public/assets/img/avatar.jpg`

- Aparece en el círculo de la portada y en el botón redondo de arriba a la izquierda.
- Conviene que sea cuadrada, porque se recorta en círculo.
- **Pendiente:** el archivo aún no existe.

## Carrusel de fotos (botón de arriba a la izquierda)

Al pulsar la foto de perfil se abre un carrusel a pantalla completa.

**Lista de imágenes:** `galleryImages` en `src/app/pages/index/index.ts`

```ts
galleryImages = [
  'assets/img/gallery-1.jpg',
  'assets/img/gallery-2.jpg',
  ...
];
```

- Los archivos van en `public/assets/img/`.
- Se pueden añadir, quitar o reordenar líneas. Admite cualquier nombre y formato (`.jpg`, `.png` o `.webp`), porque cada ruta se escribe entera.
- Tamaño recomendado: unos 1600–2000 px de lado largo. Se muestran enteras, sin recortar, así que valen tanto verticales como horizontales.
- **Pendiente:** ninguna de las imágenes existe todavía, así que el carrusel sale vacío.

---

## Textos de las secciones

| Sección                           | Archivo                                                   |
|-----------------------------------|-----------------------------------------------------------|
| Portada (nombre, rol)             | `src/app/pages/index/sections/intro-hero/intro-hero.html` (el nombre que se escribe está en `fullText`, en `intro-hero.ts`) |
| Quién soy / Del análisis a producción | `src/app/pages/index/sections/about/about.html`       |
| ¿Por qué yo?                      | `src/app/pages/index/sections/why-me/why-me.html`         |
| Habilidades (tarjetas)            | `src/app/pages/index/sections/skills/skills.html`         |
| Let's talk (contacto)             | `src/app/pages/index/sections/contact/contact.html`       |

### Tarjetas de habilidades

- Logos: `public/assets/img/skills/`, en SVG de [Simple Icons](https://simpleicons.org) (licencia CC0).
- Cada logo se pone así: `style="--icon: url('assets/img/skills/nombre.svg')"`. Se tiñe solo con el azul de la marca, así que el color original del SVG no importa.
- Si añades una tarjeta, copia una entera: cada una lleva al principio `<div class="section-5__light" aria-hidden="true"></div>`, que es su luz de colores. Por lo demás, la luz se adapta sola al número de tarjetas.

### Contacto

- **Pendiente:**
  - poner los enlaces reales de GitHub, LinkedIn y X;
  - decidir si se publica el teléfono.
- El email y el teléfono llevan la ola de color con la clase `wave-loop`.

---

## CV en PDF

**Archivo:** `public/assets/cv/daniel-soltero-cv.pdf`

- Lo descarga el botón "Descargar CV" de Contacto.
- **Pendiente:** el archivo aún no existe.
