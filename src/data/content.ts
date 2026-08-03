import type { LocalizedString } from "@/lib/i18n";

export type AssetKind = "image" | "video" | "pdf" | "icon";

export type ProjectMedia = {
  type: "video" | "image";
  src: string;
  aspect: "mobile" | "desktop" | "desktop-wide";
  alt: LocalizedString;
};

export type ProjectLink = {
  kind: "github" | "live" | "placeholder";
  href?: string;
  labelKey: "github" | "caseStudy" | "live";
};

export type Project = {
  id: "entrenar" | "gympoint-app" | "gympoint-landing";
  name: string;
  tag: string;
  description: LocalizedString;
  inDevelopment?: boolean;
  tech: string[];
  links: ProjectLink[];
  media: ProjectMedia[];
};

export type Service = {
  id: "web-audit" | "landing" | "ecommerce" | "automation";
  title: LocalizedString;
  description: LocalizedString;
  features: LocalizedString[];
  details: {
    intro: LocalizedString[];
    ctaLabel: LocalizedString;
    idealFor: LocalizedString;
    result: LocalizedString;
    reviewTitle: LocalizedString;
    reviewIncludes: LocalizedString[];
    deliverablesTitle: LocalizedString;
    deliverables: LocalizedString[];
    examplesTitle?: LocalizedString;
    examples?: LocalizedString[];
    expandableScopeTitle?: LocalizedString;
    expandableScope?: LocalizedString[];
  };
  icon: string;
};

export type StackCategory = {
  id: "frontend-ui" | "backend-data" | "devops-tools" | "workflow-ai";
  title: LocalizedString;
  tools: Array<{
    name: string;
    icon: string;
  }>;
};

export const contactLinks = {
  email: "mailto:nicolasnoir91@gmail.com",
  linkedIn: "https://www.linkedin.com/in/nahuelnicolasnoir/",
  github: "https://github.com/nanonoir",
  whatsApp:
    "https://api.whatsapp.com/send/?phone=543794657335&text=Hola&type=phone_number&app_absent=0",
} as const;

export const assets = {
  hero: "/animationHero.avif",
  profile: "/profile.jpg",
  diploma: "/TituloNoirNahuel.pdf",
  resume: {
    es: "/Noir_Nahuel_Nicolas_ES.pdf",
    en: "/Noir_Nahuel_Nicolas_EN.pdf",
  },
  iconFallback: "/handwritten-icons/cross.svg",
  icons: {
    airplane: "/handwritten-icons/airplane.svg",
    about: "/handwritten-icons/about.svg",
    card: "/handwritten-icons/card.svg",
    close: "/handwritten-icons/close.svg",
    custom: "/handwritten-icons/custom.svg",
    home: "/handwritten-icons/home.svg",
    language: "/handwritten-icons/language.svg",
    menu: "/handwritten-icons/menu.svg",
    moon: "/handwritten-icons/moon.svg",
    pause: "/handwritten-icons/pause.svg",
    play: "/handwritten-icons/play.svg",
    project: "/handwritten-icons/project.svg",
    request: "/handwritten-icons/request.svg",
    service: "/handwritten-icons/service.svg",
    sun: "/handwritten-icons/sun.svg",
    toolbox: "/handwritten-icons/toolbox.svg",
    view: "/handwritten-icons/view.svg",
  },
} as const;

export const projects: Project[] = [
  {
    id: "entrenar",
    name: "EntrenAR",
    tag: "Frontend prototype · Mock data",
    description: {
      es: "Prototipo frontend con datos mock para una experiencia de nutrición deportiva: recomendaciones, catálogo, seguimiento, perfiles y pantallas orientadas a CRM. Demuestra arquitectura de interfaz, flujos de producto y trabajo responsive; no incluye APIs ni backend operativo.",
      en: "Mock-backed frontend prototype for a sports-nutrition experience: recommendations, listings, tracking, profiles, and CRM-oriented screens. It demonstrates interface architecture, product flows, and responsive work; it has no APIs or operational backend.",
    },
    tech: ["Next.js", "TypeScript", "TailwindCSS"],
    inDevelopment: true,
    links: [{ kind: "github", href: "https://github.com/nanonoir/entrenAR", labelKey: "github" }],
    media: [
      {
        type: "image",
        src: "/projectEntrenAR/EntrenAR.webp",
        aspect: "desktop",
        alt: {
          es: "Vista principal del proyecto EntrenAR",
          en: "Main view of the EntrenAR project",
        },
      },
    ],
  },
  {
    id: "gympoint-app",
    name: "GymPoint Fitness App",
    tag: "Mobile · Fitness",
    description: {
      es: "GymPoint Mobile es una aplicación fitness colaborativa en React Native. Lideré el desarrollo frontend y aporté soporte limitado de backend para descubrir gimnasios, gestionar rutinas y seguir el progreso.",
      en: "GymPoint Mobile is a collaborative React Native fitness app. I led frontend development and contributed limited backend support for gym discovery, routine management, and progress tracking.",
    },
    tech: ["React Native", "Node.js", "Express", "PostgreSQL", "Docker", "JWT"],
    links: [{ kind: "github", href: "https://github.com/gonzaloogv/GymPoint", labelKey: "github" }],
    media: [
      {
        type: "video",
        src: "/projectGymPoint/gympointApp.mp4",
        aspect: "desktop",
        alt: {
          es: "Video de Gympoint Fitness App",
          en: "Gympoint Fitness App video",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Inicio.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de inicio de Gympoint Fitness App",
          en: "Gympoint Fitness App home screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Login.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de inicio de sesión de Gympoint Fitness App",
          en: "Gympoint Fitness App login screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Registro.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de registro de Gympoint Fitness App",
          en: "Gympoint Fitness App registration screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Registro 2.avif",
        aspect: "mobile",
        alt: {
          es: "Segunda pantalla de registro de Gympoint Fitness App",
          en: "Gympoint Fitness App second registration screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Gym.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de gimnasio de Gympoint Fitness App",
          en: "Gympoint Fitness App gym screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Mapa.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de mapa de Gympoint Fitness App",
          en: "Gympoint Fitness App map screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Ejercicio.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de ejercicio de Gympoint Fitness App",
          en: "Gympoint Fitness App exercise screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Rutinas.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de rutinas de Gympoint Fitness App",
          en: "Gympoint Fitness App routines screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/CrearRutinaDark.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla para crear rutina de Gympoint Fitness App",
          en: "Gympoint Fitness App create routine screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/CrearRutina2Dark.avif",
        aspect: "mobile",
        alt: {
          es: "Segunda pantalla para crear rutina de Gympoint Fitness App",
          en: "Gympoint Fitness App second create routine screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/CrearRutina3Dark.avif",
        aspect: "mobile",
        alt: {
          es: "Tercera pantalla para crear rutina de Gympoint Fitness App",
          en: "Gympoint Fitness App third create routine screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Progreso.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de progreso de Gympoint Fitness App",
          en: "Gympoint Fitness App progress screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/ProgresoEjercicio.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de progreso por ejercicio de Gympoint Fitness App",
          en: "Gympoint Fitness App exercise progress screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Perfil.avif",
        aspect: "mobile",
        alt: {
          es: "Pantalla de perfil de Gympoint Fitness App",
          en: "Gympoint Fitness App profile screen",
        },
      },
      {
        type: "image",
        src: "/projectGymPoint/Perfil2.avif",
        aspect: "mobile",
        alt: {
          es: "Segunda pantalla de perfil de Gympoint Fitness App",
          en: "Gympoint Fitness App second profile screen",
        },
      },
    ],
  },
  {
    id: "gympoint-landing",
    name: "Gympoint Landing Page",
    tag: "Landing · SaaS",
    description: {
      es: "Landing page en React que presenta las funcionalidades de la app con contenido visual y ofrece canales de contacto y registro para gimnasios conectados a una API propia.",
      en: "React landing page that presents the app's features with visual content and offers contact and registration channels for gyms connected to a custom API.",
    },
    tech: ["React", "TypeScript", "TailwindCSS"],
    links: [
      { kind: "github", href: "https://github.com/nanonoir/gympoint-landing", labelKey: "github" },
      { kind: "live", href: "https://gympoint-landing.vercel.app/", labelKey: "live" },
    ],
    media: [
      {
        type: "video",
        src: "/projectLandingGym/gympointLanding.mp4",
        aspect: "desktop-wide",
        alt: {
          es: "Video de Gympoint Landing Page",
          en: "Gympoint Landing Page video",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/Home.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Hero de Gympoint Landing Page",
          en: "Gympoint Landing Page hero",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/FeaturesSection.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección de funcionalidades de Gympoint Landing Page",
          en: "Gympoint Landing Page features section",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/AboutSection.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección sobre la app de Gympoint Landing Page",
          en: "Gympoint Landing Page about section",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/GymRegisterSection.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección de registro de gimnasios de Gympoint Landing Page",
          en: "Gympoint Landing Page gym registration section",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/SocialMediaSection.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección de redes sociales de Gympoint Landing Page",
          en: "Gympoint Landing Page social media section",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/ReviewsSection.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección de reseñas de Gympoint Landing Page",
          en: "Gympoint Landing Page reviews section",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/FormStep1.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Primer paso del formulario de Gympoint Landing Page",
          en: "Gympoint Landing Page form step one",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/FormStep2.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Segundo paso del formulario de Gympoint Landing Page",
          en: "Gympoint Landing Page form step two",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/FormStep3.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Tercer paso del formulario de Gympoint Landing Page",
          en: "Gympoint Landing Page form step three",
        },
      },
      {
        type: "image",
        src: "/projectLandingGym/FullContact.avif",
        aspect: "desktop-wide",
        alt: {
          es: "Sección completa de contacto de Gympoint Landing Page",
          en: "Gympoint Landing Page full contact section",
        },
      },
    ],
  },
];

export const services: Service[] = [
  {
    id: "web-audit",
    title: { es: "Auditoría Web", en: "Web Audit" },
    description: {
      es: "Audito tu página y te entrego un reporte claro con métricas, errores, oportunidades de UX/UI, performance, SEO y mejoras para aumentar conversión.",
      en: "I audit your website and deliver a clear report with metrics, issues, UX/UI opportunities, performance, SEO, and improvements to increase conversion.",
    },
    features: [
      { es: "Revisión de performance y accesibilidad", en: "Performance and accessibility review" },
      { es: "Oportunidades de UX/UI y conversión", en: "UX/UI and conversion opportunities" },
      { es: "Reporte priorizado de mejoras", en: "Prioritized improvement report" },
    ],
    details: {
      intro: [
        {
          es: "Reviso tu web para detectar qué está frenando que las personas entiendan tu negocio, confíen en tu marca y te contacten.",
          en: "I review your website to detect what is stopping people from understanding your business, trusting your brand and contacting you.",
        },
        {
          es: "El objetivo es ayudarte a mejorar cómo se presenta tu web, qué tan clara resulta para tus clientes y qué cambios pueden aumentar las consultas, ventas o contactos desde tu sitio.",
          en: "The goal is to help you improve how your website presents your business, how clear it feels to your customers and what changes can increase inquiries, sales or contacts from your site.",
        },
      ],
      ctaLabel: { es: "Solicitar auditoría →", en: "Request audit →" },
      idealFor: {
        es: "Negocios, marcas personales, profesionales o emprendimientos que ya tienen una web, pero sienten que no está generando suficientes consultas, ventas o confianza.",
        en: "Businesses, personal brands, professionals or entrepreneurs who already have a website, but feel it is not generating enough inquiries, sales or trust.",
      },
      result: {
        es: "Al finalizar, vas a saber qué está frenando tu web, qué deberías mejorar primero y qué cambios pueden ayudarte a convertir más visitas en consultas, ventas o clientes.",
        en: "By the end, you will know what is holding your website back, what you should improve first and what changes can help you turn more visits into inquiries, sales or customers.",
      },
      reviewTitle: { es: "Qué reviso", en: "What I review" },
      reviewIncludes: [
        { es: "Si tu negocio se entiende rápido al entrar a la web", en: "If your business is easy to understand as soon as someone enters your website" },
        { es: "Si la página transmite confianza y profesionalismo", en: "If the website feels trustworthy and professional" },
        { es: "Si el recorrido para contactarte o comprar es claro", en: "If the path to contact you or buy from you is clear" },
        { es: "Si hay textos, secciones o botones que pueden mejorarse", en: "If there are texts, sections or buttons that can be improved" },
        { es: "Si tu web está preparada para verse bien en celular", en: "If your website is ready to look good on mobile" },
        { es: "Si carga de forma rápida y cómoda para el usuario", en: "If it loads fast and feels comfortable to use" },
        { es: "Si está mejor preparada para aparecer en Google", en: "If it is better prepared to appear on Google" },
        { es: "Si está mejor preparada para ser entendida por IAs como ChatGPT, Gemini o Claude", en: "If it is better prepared to be understood by AIs like ChatGPT, Gemini or Claude" },
      ],
      deliverablesTitle: { es: "Qué entrego", en: "What I deliver" },
      deliverables: [
        { es: "Documento formal de auditoría", en: "Formal website audit document" },
        { es: "Resumen general con los puntos más importantes", en: "General summary with the most important points" },
        { es: "Diagnóstico por áreas: claridad, confianza, navegación, celular, velocidad y visibilidad", en: "Diagnosis by area: clarity, trust, navigation, mobile, speed and visibility" },
        { es: "Lista de mejoras recomendadas", en: "List of recommended improvements" },
        { es: "Prioridad sugerida para cada cambio", en: "Suggested priority for each change" },
        { es: "Nivel de impacto estimado: alto, medio o bajo", en: "Estimated impact level: high, medium or low" },
        { es: "Checklist de acciones rápidas", en: "Quick action checklist" },
        { es: "Ideas concretas para mejorar consultas, ventas o contactos", en: "Concrete ideas to improve inquiries, sales or contacts" },
      ],
    },
    icon: "/handwritten-icons/audit.svg",
  },
  {
    id: "landing",
    title: { es: "Landing / Web Institucional", en: "Landing / Business Website" },
    description: {
      es: "Diseño y desarrollo sitios rápidos, modernos y profesionales para presentar tu negocio, servicio o marca personal.",
      en: "I design and build fast, modern, professional websites to present your business, service, or personal brand.",
    },
    features: [
      { es: "Arquitectura de secciones y copy base", en: "Section architecture and base copy" },
      { es: "Implementación responsive y bilingüe", en: "Responsive and bilingual implementation" },
      { es: "Base lista para medir y optimizar", en: "Measurement-ready foundation" },
    ],
    details: {
      intro: [
        {
          es: "Construyo una web profesional para que tu negocio se vea confiable, se entienda rápido y convierta visitas en contactos reales.",
          en: "I build a professional website so your business looks trustworthy, is easy to understand and turns visits into real contacts.",
        },
        {
          es: "La web se desarrolla con estructura, contenido y configuración pensada para posicionar tu marca en Google y en respuestas de inteligencias artificiales como ChatGPT, Gemini o Claude.",
          en: "The website is built with structure, content and configuration designed to position your brand on Google and in AI-powered answers from tools like ChatGPT, Gemini or Claude.",
        },
      ],
      ctaLabel: { es: "Solicitar web →", en: "Request website →" },
      idealFor: {
        es: "Profesionales, marcas personales, emprendimientos, estudios, negocios locales o empresas que necesitan una presencia digital seria, moderna y orientada a generar consultas, clientes o ventas.",
        en: "Professionals, personal brands, entrepreneurs, studios, local businesses or companies that need a serious, modern digital presence focused on generating inquiries, customers or sales.",
      },
      result: {
        es: "Al finalizar, vas a tener una web profesional, lista para compartir y pensada para atraer más consultas, generar confianza y posicionar mejor tu negocio en internet.",
        en: "By the end, you will have a professional website ready to share, designed to attract more inquiries, build trust and position your business better online.",
      },
      reviewTitle: { es: "Qué incluye", en: "What is included" },
      reviewIncludes: [
        { es: "Diseño y desarrollo de la web", en: "Website design and development" },
        { es: "Versión adaptada para celular, tablet y computadora", en: "Version adapted for mobile, tablet and desktop" },
        { es: "Secciones claras para presentar tu negocio, servicios y contacto", en: "Clear sections to present your business, services and contact options" },
        { es: "Textos base orientados a comunicar mejor y convertir más consultas", en: "Base copy focused on better communication and more inquiries" },
        { es: "Botones de contacto por WhatsApp, email, formulario o redes", en: "Contact buttons for WhatsApp, email, form or social media" },
        { es: "Optimización SEO para buscadores como Google", en: "SEO optimization to help your business rank better on Google" },
        { es: "Optimización AEO/GEO para respuestas de inteligencias artificiales", en: "AEO/GEO optimization so your brand can appear better in AI-powered answers" },
        { es: "Configuración para compartir correctamente el link en redes y WhatsApp", en: "Configuration so your link looks good when shared on social media and WhatsApp" },
        { es: "Publicación final de la web", en: "Final website publication" },
      ],
      deliverablesTitle: { es: "Qué entrego", en: "What I deliver" },
      deliverables: [
        { es: "Web publicada y funcionando", en: "Published and working website" },
        { es: "Código fuente del proyecto", en: "Project source code" },
        { es: "Documentación completa del sistema", en: "Complete system documentation" },
        { es: "Funcionalidades implementadas", en: "Implemented features" },
        { es: "Arquitectura general", en: "General architecture" },
        { es: "Recomendaciones para mantener o escalar la web", en: "Recommendations to maintain or scale the website" },
      ],
      expandableScopeTitle: { es: "Alcance ampliable", en: "Expandable scope" },
      expandableScope: [
        { es: "El servicio puede extenderse con automatización de turnos, integración con WhatsApp, formularios avanzados, paneles internos, pagos, bases de datos, emails automáticos u otras funcionalidades a medida.", en: "The service can be extended with appointment automation, WhatsApp integration, advanced forms, internal panels, payments, databases, automatic emails or other custom features." },
      ],
    },
    icon: "/handwritten-icons/landing.svg",
  },
  {
    id: "ecommerce",
    title: { es: "Tienda E-commerce", en: "E-commerce Store" },
    description: {
      es: "Construyo tiendas online con catálogo, carrito, checkout, medios de pago y una experiencia pensada para vender.",
      en: "I build online stores with catalog, cart, checkout, payment flows, and an experience designed to sell.",
    },
    features: [
      { es: "Catálogo y flujo de compra", en: "Catalog and purchase flow" },
      { es: "Checkout y medios de pago", en: "Checkout and payment flows" },
      { es: "Panel o base administrable", en: "Admin-ready foundation" },
    ],
    details: {
      intro: [
        {
          es: "Construyo una tienda online profesional para que tu negocio pueda vender productos de forma clara, confiable y ordenada.",
          en: "I build a professional online store so your business can sell products in a clear, trustworthy and organized way.",
        },
        {
          es: "No se trata solo de subir productos a internet. La tienda se desarrolla para mostrar mejor lo que vendés, facilitar el proceso de compra y convertir visitas en pedidos reales.",
          en: "This is not just about uploading products to the internet. The store is built to showcase what you sell, make the buying process easier and turn visits into real orders.",
        },
      ],
      ctaLabel: { es: "Solicitar tienda →", en: "Request store →" },
      idealFor: {
        es: "Marcas, emprendimientos, negocios locales o empresas que quieren vender online con una tienda propia, profesional y preparada para crecer más allá de Instagram, WhatsApp o marketplaces.",
        en: "Brands, entrepreneurs, local businesses or companies that want to sell online with their own professional store, ready to grow beyond Instagram, WhatsApp or marketplaces.",
      },
      result: {
        es: "Al finalizar, vas a tener una tienda online profesional, lista para vender, pensada para generar confianza, mostrar mejor tus productos y convertir visitas en pedidos reales.",
        en: "By the end, you will have a professional online store ready to sell, designed to build trust, present your products better and turn visits into real orders.",
      },
      reviewTitle: { es: "Qué incluye", en: "What is included" },
      reviewIncludes: [
        { es: "Diseño y desarrollo de la tienda online", en: "Online store design and development" },
        { es: "Catálogo de productos organizado por categorías", en: "Product catalog organized by categories" },
        { es: "Páginas individuales para cada producto", en: "Individual pages for each product" },
        { es: "Carrito de compras", en: "Shopping cart" },
        { es: "Flujo de checkout", en: "Checkout flow" },
        { es: "Integración con medio de pago", en: "Payment method integration" },
        { es: "Configuración de métodos de envío o entrega", en: "Shipping or delivery method setup" },
        { es: "Gestión de datos del cliente para completar pedidos", en: "Customer data collection to complete orders" },
        { es: "Diseño adaptado para celular, tablet y computadora", en: "Design adapted for mobile, tablet and desktop" },
        { es: "Botones de contacto por WhatsApp, email o formulario", en: "Contact buttons for WhatsApp, email or form" },
        { es: "Optimización para que tus productos y categorías puedan posicionarse mejor en Google", en: "Optimization so your products and categories can rank better on Google" },
        { es: "Optimización para que tu tienda, productos y marca puedan ser mejor encontrados por IAs como ChatGPT, Gemini, Claude y otros asistentes", en: "Optimization so your store, products and brand can be found better by AIs like ChatGPT, Gemini, Claude and other assistants" },
        { es: "Configuración para que tus productos se compartan correctamente en redes y WhatsApp", en: "Configuration so your products look good when shared on social media and WhatsApp" },
        { es: "Publicación final de la tienda", en: "Final store publication" },
      ],
      deliverablesTitle: { es: "Qué entrego", en: "What I deliver" },
      deliverables: [
        { es: "Tienda publicada y funcionando", en: "Published and working online store" },
        { es: "Código fuente del proyecto", en: "Project source code" },
        { es: "Documentación completa del sistema", en: "Complete system documentation" },
        { es: "Guía para administrar o mantener la tienda", en: "Simple guide to manage or maintain the store" },
        { es: "Recomendaciones para mejorar ventas, carga de productos y crecimiento futuro", en: "Recommendations to improve sales, product loading and future growth" },
      ],
      expandableScopeTitle: { es: "Alcance ampliable", en: "Expandable scope" },
      expandableScope: [
        { es: "La tienda puede extenderse con panel administrativo, gestión avanzada de stock, cupones, descuentos, emails automáticos, recuperación de carritos, integración con WhatsApp, CRM, reportes de ventas, automatizaciones internas u otras funcionalidades a medida.", en: "The store can be extended with an admin panel, advanced stock management, coupons, discounts, automatic emails, abandoned cart recovery, WhatsApp integration, CRM, sales reports, internal automations or other custom features." },
      ],
    },
    icon: "/handwritten-icons/store.svg",
  },
  {
    id: "automation",
    title: { es: "Automatizaciones", en: "Automations" },
    description: {
      es: "Automatizo tareas, formularios, integraciones y procesos internos con herramientas modernas, APIs e IA.",
      en: "I automate tasks, forms, integrations, and internal processes with modern tools, APIs, and AI.",
    },
    features: [
      { es: "Integraciones con APIs y herramientas", en: "API and tool integrations" },
      { es: "Flujos internos repetibles", en: "Repeatable internal workflows" },
      { es: "Automatizaciones con IA cuando aporta valor", en: "AI automation where it adds value" },
    ],
    details: {
      intro: [
        {
          es: "Automatizo procesos repetitivos para que tu negocio pueda atender más rápido, ordenar consultas, recibir pedidos, agendar turnos y ahorrar tiempo todos los días.",
          en: "I automate repetitive processes so your business can respond faster, organize inquiries, receive orders, schedule appointments and save time every day.",
        },
        {
          es: "Procesos funcionando solos: respuestas a clientes, toma de pedidos, agenda de turnos, filtros de consultas, avisos automáticos, registro de datos y derivación de información a la persona correcta.",
          en: "Processes working on their own: customer replies, order taking, appointment scheduling, inquiry filtering, automatic notifications, data registration and sending the right information to the right person.",
        },
      ],
      ctaLabel: { es: "Solicitar automatización →", en: "Request automation →" },
      idealFor: {
        es: "Negocios, profesionales o equipos que pierden tiempo respondiendo siempre lo mismo, anotando pedidos a mano, coordinando turnos, filtrando clientes o pasando información entre WhatsApp, planillas, emails y sistemas.",
        en: "Businesses, professionals or teams that waste time answering the same questions, writing down orders manually, scheduling appointments, filtering customers or moving information between WhatsApp, spreadsheets, emails and systems.",
      },
      result: {
        es: "Al finalizar, vas a tener un proceso más rápido y ordenado, pensado para atender mejor, perder menos oportunidades y convertir más consultas en clientes, pedidos o turnos reales.",
        en: "By the end, you will have a faster and more organized process, designed to help you serve customers better, lose fewer opportunities and turn more inquiries into real customers, orders or appointments.",
      },
      reviewTitle: { es: "Qué incluye", en: "What is included" },
      reviewIncludes: [
        { es: "Revisión del proceso que querés mejorar", en: "Review of the process you want to improve" },
        { es: "Diseño del flujo ideal para tu negocio", en: "Design of the ideal flow for your business" },
        { es: "Automatización de respuestas, pedidos, turnos, avisos o registros", en: "Automation of replies, orders, appointments, notifications or records" },
        { es: "Integración con WhatsApp, formularios, emails, planillas, calendarios o herramientas que ya uses", en: "Integration with WhatsApp, forms, emails, spreadsheets, calendars or tools you already use" },
        { es: "Uso de inteligencia artificial cuando ayude a responder, clasificar, ordenar o filtrar consultas", en: "Use of artificial intelligence when it helps reply, classify, organize or filter inquiries" },
        { es: "Pruebas con casos reales antes de entregar", en: "Testing with real cases before delivery" },
        { es: "Ajustes para que el flujo sea claro y fácil de usar", en: "Adjustments so the flow is clear and easy to use" },
      ],
      deliverablesTitle: { es: "Qué entrego", en: "What I deliver" },
      deliverables: [
        { es: "Automatización funcionando", en: "Working automation" },
        { es: "Documentación clara del flujo", en: "Clear documentation of the flow" },
        { es: "Guía simple de uso", en: "Simple usage guide" },
        { es: "Explicación de cómo funciona el proceso", en: "Explanation of how the process works" },
        { es: "Recomendaciones para mejorar atención, ventas o seguimiento", en: "Recommendations to improve customer service, sales or follow-up" },
      ],
      examplesTitle: { es: "Ejemplos de lo que se puede automatizar", en: "Examples of what can be automated" },
      examples: [
        { es: "Un local de comida puede recibir pedidos pagados y enviarlos automáticamente a cocina", en: "A food business can receive paid orders and send them automatically to the kitchen" },
        { es: "Una barbería puede responder consultas y agendar turnos sin depender todo el tiempo del celular", en: "A barber shop can answer questions and schedule appointments without depending on the phone all day" },
        { es: "Una inmobiliaria puede filtrar interesados, pedir datos clave y separar consultas reales de curiosos", en: "A real estate business can filter interested people, ask for key information and separate real prospects from casual inquiries" },
        { es: "Una tienda puede enviar avisos de pedido, pagos, entregas o carritos abandonados", en: "A store can send order, payment, delivery or abandoned cart notifications" },
        { es: "Un profesional puede recibir formularios ordenados y responder más rápido a potenciales clientes", en: "A professional can receive organized forms and respond faster to potential clients" },
      ],
      expandableScopeTitle: { es: "Alcance ampliable", en: "Expandable scope" },
      expandableScope: [
        { es: "El servicio puede extenderse con asistentes por WhatsApp, gestión de turnos, pedidos automáticos, cobros, emails automáticos, seguimiento de clientes, reportes, integración con CRM, paneles internos o flujos más avanzados con inteligencia artificial.", en: "The service can be extended with WhatsApp assistants, appointment management, automatic orders, payments, automatic emails, customer follow-up, reports, CRM integration, internal panels or more advanced AI-powered flows." },
      ],
    },
    icon: "/handwritten-icons/automation.svg",
  },
];

export const stackCategories: StackCategory[] = [
  {
    id: "frontend-ui",
    title: { es: "Frontend & UI", en: "Frontend & UI" },
    tools: [
      { name: "React", icon: "/handwritten-icons/react.svg" },
      { name: "Next.js", icon: "/handwritten-icons/nextjs.svg" },
      { name: "TypeScript", icon: "/handwritten-icons/typescript.svg" },
      { name: "JavaScript", icon: "/handwritten-icons/javascript.svg" },
      { name: "TailwindCSS", icon: "/handwritten-icons/tailwind.svg" },
      { name: "React Native", icon: "/handwritten-icons/react.svg" },
      { name: "Vue.js", icon: "/handwritten-icons/vuejs.svg" },
      { name: "Astro", icon: "/handwritten-icons/astro.svg" },
      { name: "HTML", icon: "/handwritten-icons/html5.svg" },
      { name: "CSS", icon: "/handwritten-icons/css3.svg" },
    ],
  },
  {
    id: "backend-data",
    title: { es: "Backend & Data", en: "Backend & Data" },
    tools: [
      { name: "Node.js", icon: "/handwritten-icons/nodejs.svg" },
      { name: "Express", icon: "/handwritten-icons/express.svg" },
      { name: "NestJS", icon: "/handwritten-icons/nestjs.svg" },
      { name: "PostgreSQL", icon: "/handwritten-icons/postgresql.svg" },
      { name: "MySQL", icon: "/handwritten-icons/mysql.svg" },
      { name: "MongoDB", icon: "/handwritten-icons/mongodb.svg" },
      { name: "Prisma", icon: "/handwritten-icons/prisma.svg" },
      { name: "Sequelize", icon: "/handwritten-icons/sequelize.svg" },
      { name: "REST APIs", icon: "/handwritten-icons/api.svg" },
      { name: "JWT", icon: "/handwritten-icons/jwt.svg" },
    ],
  },
  {
    id: "devops-tools",
    title: { es: "DevOps & Tools", en: "DevOps & Tools" },
    tools: [
      { name: "Git", icon: "/handwritten-icons/git.svg" },
      { name: "GitHub", icon: "/handwritten-icons/github.svg" },
      { name: "Docker", icon: "/handwritten-icons/docker.svg" },
      { name: "Vercel", icon: "/handwritten-icons/vercel.svg" },
      { name: "Railway", icon: "/handwritten-icons/railway.svg" },
      { name: "VPS", icon: "/handwritten-icons/vps.svg" },
      { name: "Nginx", icon: "/handwritten-icons/nginx.svg" },
      { name: "Linux", icon: "/handwritten-icons/linux.svg" },
      { name: "Postman", icon: "/handwritten-icons/postman.svg" },
      { name: "CI/CD", icon: "/handwritten-icons/cicd.svg" },
    ],
  },
  {
    id: "workflow-ai",
    title: { es: "Workflow & AI", en: "Workflow & AI" },
    tools: [
      { name: "OpenCode", icon: "/handwritten-icons/opencode.svg" },
      { name: "Claude Code", icon: "/handwritten-icons/claude.svg" },
      { name: "n8n", icon: "/handwritten-icons/n8n.svg" },
      { name: "MCP", icon: "/handwritten-icons/mcp.svg" },
      { name: "Notion", icon: "/handwritten-icons/notion.svg" },
      { name: "Jira", icon: "/handwritten-icons/jira.svg" },
      { name: "Trello", icon: "/handwritten-icons/trello.svg" },
      { name: "Slack", icon: "/handwritten-icons/slack.svg" },
      { name: "Webhooks", icon: "/handwritten-icons/webhook.svg" },
    ],
  },
];

export const aboutOrbitTech = [
  // Outer ring (first 4): Node.js, PostgreSQL, Docker, JavaScript
  { name: "Node.js", icon: "/handwritten-icons/nodejs.svg" },
  { name: "PostgreSQL", icon: "/handwritten-icons/postgresql.svg" },
  { name: "Docker", icon: "/handwritten-icons/docker.svg" },
  { name: "JavaScript", icon: "/handwritten-icons/javascript.svg" },
  // Inner ring (last 3): React, Next.js, TypeScript
  { name: "React", icon: "/handwritten-icons/react.svg" },
  { name: "Next.js", icon: "/handwritten-icons/nextjs.svg" },
  { name: "TypeScript", icon: "/handwritten-icons/typescript.svg" },
] as const;
