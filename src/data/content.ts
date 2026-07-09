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
    intro: LocalizedString;
    idealFor: LocalizedString;
    result: LocalizedString;
    reviewIncludes: LocalizedString[];
    deliverables: LocalizedString[];
    examples?: LocalizedString[];
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
    tag: "E-commerce / CRM",
    description: {
      es: "Plataforma de e-commerce especializada en nutrición deportiva, complementada con un CRM de gestión para administrar productos, pedidos, clientes y ventas. Desarrollada con foco en rendimiento, experiencia de usuario y escalabilidad.",
      en: "E-commerce platform focused on sports nutrition, complemented by a management CRM to handle products, orders, customers, and sales. Built with a focus on performance, user experience, and scalability.",
    },
    tech: ["Next.js", "TypeScript", "TailwindCSS", "Prisma", "PostgreSQL"],
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
    name: "Gympoint Fitness App",
    tag: "Mobile · Fitness",
    description: {
      es: "Aplicación fitness en React Native que permite descubrir gimnasios cercanos, gestionar rutinas y seguir el progreso del usuario. Integra autenticación JWT, roles de usuario y una API REST propia.",
      en: "React Native fitness app that lets users discover nearby gyms, manage workout routines, and track their progress. It includes JWT authentication, user roles, and a custom REST API.",
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
      intro: {
        es: "Una revisión técnica y visual para detectar qué está frenando la confianza, la velocidad y la conversión de tu sitio.",
        en: "A technical and visual review to identify what is slowing down trust, speed, and conversion on your site.",
      },
      idealFor: {
        es: "Negocios con una web existente que necesitan claridad antes de rediseñar, invertir en campañas o priorizar mejoras.",
        en: "Businesses with an existing website that need clarity before redesigning, investing in campaigns, or prioritizing improvements.",
      },
      result: {
        es: "Recibís un diagnóstico priorizado con acciones concretas para mejorar performance, UX/UI, SEO técnico y conversión.",
        en: "You receive a prioritized diagnosis with concrete actions to improve performance, UX/UI, technical SEO, and conversion.",
      },
      reviewIncludes: [
        { es: "Performance, accesibilidad y buenas prácticas técnicas.", en: "Performance, accessibility, and technical best practices." },
        { es: "Claridad de propuesta, jerarquía visual y puntos de fricción.", en: "Offer clarity, visual hierarchy, and friction points." },
        { es: "SEO técnico básico y oportunidades de conversión.", en: "Basic technical SEO and conversion opportunities." },
      ],
      deliverables: [
        { es: "Reporte accionable con prioridades por impacto.", en: "Actionable report prioritized by impact." },
        { es: "Lista de mejoras rápidas y recomendaciones estructurales.", en: "Quick-win list and structural recommendations." },
      ],
      expandableScope: [
        { es: "Implementación posterior de las mejoras detectadas.", en: "Follow-up implementation of the detected improvements." },
        { es: "Rediseño de secciones críticas o medición de eventos.", en: "Redesign of critical sections or event tracking setup." },
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
      intro: {
        es: "Un sitio claro, rápido y profesional para presentar tu negocio, servicio o marca personal con foco en conversión.",
        en: "A clear, fast, professional site to present your business, service, or personal brand with a conversion focus.",
      },
      idealFor: {
        es: "Profesionales, marcas y empresas que necesitan presencia digital sólida sin construir una plataforma completa.",
        en: "Professionals, brands, and companies that need a strong digital presence without building a full platform.",
      },
      result: {
        es: "Obtenés una landing o web institucional responsive, bilingüe si hace falta, y preparada para medir resultados.",
        en: "You get a responsive landing or business website, bilingual if needed, and ready to measure results.",
      },
      reviewIncludes: [
        { es: "Estructura de secciones y recorrido del usuario.", en: "Section structure and user journey." },
        { es: "Diseño responsive alineado a la identidad de la marca.", en: "Responsive design aligned with the brand identity." },
        { es: "Copy base, llamadas a la acción y canales de contacto.", en: "Base copy, calls to action, and contact channels." },
      ],
      deliverables: [
        { es: "Sitio publicado y optimizado para dispositivos modernos.", en: "Published site optimized for modern devices." },
        { es: "Base técnica preparada para analítica y futuras iteraciones.", en: "Technical foundation ready for analytics and future iterations." },
      ],
      examples: [
        { es: "Landing de servicio, portfolio profesional o web institucional simple.", en: "Service landing page, professional portfolio, or simple business website." },
      ],
      expandableScope: [
        { es: "Blog, múltiples páginas, integraciones o formularios avanzados.", en: "Blog, multiple pages, integrations, or advanced forms." },
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
      intro: {
        es: "Una tienda online enfocada en mostrar productos con claridad y reducir fricción hasta la compra.",
        en: "An online store focused on presenting products clearly and reducing friction until purchase.",
      },
      idealFor: {
        es: "Marcas y comercios que quieren vender online con catálogo, carrito y un flujo preparado para crecer.",
        en: "Brands and stores that want to sell online with a catalog, cart, and a flow ready to grow.",
      },
      result: {
        es: "Un e-commerce funcional con experiencia de compra ordenada, base administrable y camino claro hacia pagos e integraciones.",
        en: "A functional e-commerce experience with organized purchasing, an admin-ready foundation, and a clear path to payments and integrations.",
      },
      reviewIncludes: [
        { es: "Catálogo, detalle de producto y navegación de compra.", en: "Catalog, product detail, and shopping navigation." },
        { es: "Carrito, checkout y estructura para medios de pago.", en: "Cart, checkout, and payment-provider structure." },
        { es: "Base de administración o integración con sistemas existentes.", en: "Admin foundation or integration with existing systems." },
      ],
      deliverables: [
        { es: "Tienda responsive lista para cargar productos y operar.", en: "Responsive store ready to load products and operate." },
        { es: "Arquitectura preparada para pagos, stock y analítica.", en: "Architecture ready for payments, stock, and analytics." },
      ],
      expandableScope: [
        { es: "Cupones, envíos, cuentas de usuario o panel administrativo completo.", en: "Coupons, shipping, user accounts, or a full admin dashboard." },
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
      intro: {
        es: "Automatizaciones para conectar herramientas, reducir tareas manuales y ordenar procesos internos repetitivos.",
        en: "Automations to connect tools, reduce manual work, and organize repetitive internal processes.",
      },
      idealFor: {
        es: "Equipos o negocios que ya tienen procesos definidos pero pierden tiempo copiando datos o respondiendo lo mismo.",
        en: "Teams or businesses with defined processes that lose time copying data or repeating the same responses.",
      },
      result: {
        es: "Un flujo automatizado, documentado y fácil de mantener que conecta formularios, APIs, notificaciones o IA cuando tiene sentido.",
        en: "An automated, documented, maintainable flow that connects forms, APIs, notifications, or AI when it makes sense.",
      },
      reviewIncludes: [
        { es: "Mapeo del proceso y puntos manuales repetidos.", en: "Process mapping and repeated manual points." },
        { es: "Integraciones con APIs, webhooks o herramientas existentes.", en: "Integrations with APIs, webhooks, or existing tools." },
        { es: "Validación de errores y trazabilidad básica.", en: "Error validation and basic traceability." },
      ],
      deliverables: [
        { es: "Flujo automatizado y documentación de uso.", en: "Automated flow and usage documentation." },
        { es: "Recomendaciones para escalar o monitorear el proceso.", en: "Recommendations to scale or monitor the process." },
      ],
      examples: [
        { es: "Leads a CRM, alertas internas, generación de reportes o asistentes con IA.", en: "Leads to CRM, internal alerts, report generation, or AI assistants." },
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
