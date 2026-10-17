export interface ProjectMedia {
  src: string;
  type: 'video' | 'image';
}

// Cada proyecto se pinta como DOS capítulos seguidos (ver ProjectShowcase):
//  1. "Nombre": vídeo de portada + título + subtítulo/descripción + galería.
//  2. "Cita": otro vídeo/imagen de fondo + cita grande + texto opcional en
//     dos columnas + otra galería.
// Los vídeos de fondo avanzan con el scroll; las imágenes solo hacen push-in.
export interface ProjectStoryData {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  videoPortada: ProjectMedia;
  galeria: ProjectMedia[];

  quote: string;
  mediaQuote: ProjectMedia;
  subtituloQuote?: string;
  descripcionQuote?: string;
  galeriaQuote: ProjectMedia[];
}

const image = (name: string): ProjectMedia => ({ src: `assets/img/projects/${name}.jpg`, type: 'image' });
const video = (name: string): ProjectMedia => ({ src: `assets/video/projects/${name}.mp4`, type: 'video' });

// TODO: reemplazar por vídeos/imágenes y copy reales de cada proyecto.
// saas-secondary.mp4 es idéntico a banking-hero.mp4: se usa banking-hero en
// su lugar para no descargar ni procesar el mismo vídeo dos veces. Cuando
// tengas el vídeo real del SaaS, sustituye el archivo y vuelve a usarlo aquí. Las
// galerías reutilizan las imágenes de otros proyectos solo como relleno.
export const PROJECTS: ProjectStoryData[] = [
  {
    titulo: 'E-commerce Platform',
    subtitulo: 'De catálogo a checkout',
    descripcion:
      'Tienda online completa con catálogo, carrito y pasarela de pago, pensada para escalar a miles de productos sin perder rendimiento en ningún paso del embudo de compra.',
    videoPortada: video('ecommerce-hero'),
    galeria: [image('ecommerce-secondary'), image('ecommerce-secondary-2'), image('banking-secondary'), image('saas-secondary-2')],

    quote: 'Cada segundo de carga es un cliente que se va',
    mediaQuote: image('ecommerce-secondary'),
    subtituloQuote: 'Rendimiento medido en ventas',
    descripcionQuote:
      'Carga diferida de imágenes, caché de catálogo y un checkout de una sola página para que nada se interponga entre el cliente y el botón de pagar.',
    galeriaQuote: [image('ecommerce-secondary-2'), image('banking-secondary-2'), image('ecommerce-secondary'), image('saas-secondary-2')],
  },
  {
    titulo: 'SaaS Dashboard',
    subtitulo: 'Datos en tiempo real',
    descripcion:
      'Panel de control para una herramienta SaaS, con gráficas en tiempo real, gestión de usuarios y permisos, y una arquitectura pensada para que cada equipo vea solo lo que necesita.',
    videoPortada: video('saas-hero'),
    galeria: [image('saas-secondary-2'), video('banking-hero'), image('ecommerce-secondary-2'), image('banking-secondary')],

    quote: 'Si no se puede medir, no se puede mejorar',
    mediaQuote: video('banking-hero'),
    subtituloQuote: 'Cada equipo, su vista',
    descripcionQuote:
      'Permisos por rol, paneles configurables y métricas que se actualizan solas, sin recargar la página ni perder el contexto.',
    galeriaQuote: [image('banking-secondary-2'), image('saas-secondary-2'), image('ecommerce-secondary'), image('banking-secondary')],
  },
  {
    titulo: 'Banking App',
    subtitulo: 'Seguridad sin fricción',
    descripcion:
      'Aplicación bancaria web con autenticación segura, historial de movimientos y transferencias, diseñada para que la seguridad nunca se sienta como un obstáculo.',
    videoPortada: video('banking-hero'),
    galeria: [image('banking-secondary'), image('banking-secondary-2'), image('saas-secondary-2'), image('ecommerce-secondary-2')],

    quote: 'La confianza se construye en cada transacción',
    mediaQuote: image('banking-secondary-2'),
    subtituloQuote: 'Seguro por defecto',
    descripcionQuote:
      'Autenticación en dos pasos, sesiones que caducan solas y confirmaciones claras en cada movimiento, sin pasos de más para el usuario.',
    galeriaQuote: [image('banking-secondary-2'), image('ecommerce-secondary'), image('banking-secondary'), image('saas-secondary-2')],
  },
];
