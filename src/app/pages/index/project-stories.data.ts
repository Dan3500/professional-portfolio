export interface ProjectMedia {
  src: string;
  type: 'video' | 'image';
}

export interface ProjectStoryData {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  quote: string;
  videoPortada: ProjectMedia;
  // mediaSecundaria1 es la que se expande a pantalla completa (fase 4).
  mediaSecundaria1: ProjectMedia;
  mediaSecundaria2: ProjectMedia;
}

// TODO: reemplazar por vídeos/imágenes y copy reales de cada proyecto.
export const PROJECTS: ProjectStoryData[] = [
  {
    titulo: 'E-commerce Platform',
    subtitulo: 'De catálogo a checkout',
    descripcion:
      'Tienda online completa con catálogo, carrito y pasarela de pago, pensada para escalar a miles de productos sin perder rendimiento en ningún paso del embudo de compra.',
    quote: 'Cada segundo de carga es un cliente que se va',
    videoPortada: { src: 'assets/video/projects/ecommerce-hero.mp4', type: 'video' },
    mediaSecundaria1: { src: 'assets/img/projects/ecommerce-secondary.jpg', type: 'image' },
    mediaSecundaria2: { src: 'assets/img/projects/ecommerce-secondary-2.jpg', type: 'image' },
  },
  {
    titulo: 'SaaS Dashboard',
    subtitulo: 'Datos en tiempo real',
    descripcion:
      'Panel de control para una herramienta SaaS, con gráficas en tiempo real, gestión de usuarios y permisos, y una arquitectura pensada para que cada equipo vea solo lo que necesita.',
    quote: 'Si no se puede medir, no se puede mejorar',
    videoPortada: { src: 'assets/video/projects/saas-hero.mp4', type: 'video' },
    mediaSecundaria1: { src: 'assets/video/projects/saas-secondary.mp4', type: 'video' },
    mediaSecundaria2: { src: 'assets/img/projects/saas-secondary-2.jpg', type: 'image' },
  },
  {
    titulo: 'Banking App',
    subtitulo: 'Seguridad sin fricción',
    descripcion:
      'Aplicación bancaria web con autenticación segura, historial de movimientos y transferencias, diseñada para que la seguridad nunca se sienta como un obstáculo.',
    quote: 'La confianza se construye en cada transacción',
    videoPortada: { src: 'assets/video/projects/banking-hero.mp4', type: 'video' },
    mediaSecundaria1: { src: 'assets/img/projects/banking-secondary.jpg', type: 'image' },
    mediaSecundaria2: { src: 'assets/img/projects/banking-secondary-2.jpg', type: 'image' },
  },
];
