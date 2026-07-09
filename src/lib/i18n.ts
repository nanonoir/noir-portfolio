export const SUPPORTED_LANGUAGES = ["es", "en"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type LocalizedString = Record<Language, string>;

export type Dictionary = {
  meta: {
    siteName: string;
    role: string;
  };
  navigation: {
    about: string;
    projects: string;
    services: string;
    stack: string;
    contact: string;
    resume: string;
    changeToEnglish: string;
    changeToSpanish: string;
    lightTheme: string;
    darkTheme: string;
    homeLabel: string;
    menuLabel: string;
    closeMenuLabel: string;
    themeToggleLabel: string;
    languageToggleLabel: string;
    primaryNavigationLabel: string;
    stickyNavigationLabel: string;
    mobileNavigationLabel: string;
    drawerLabel: string;
  };
  hero: {
    label: string;
    headline: string;
    italicFragment: string;
    description: string;
    ctaContact: string;
    ctaProjects: string;
    ctaServices: string;
    metric: string;
    metricPrefix: string;
    illustrationPhrase: string;
  };
  about: {
    label: string;
    title: string;
    introHeading: string;
    paragraphs: string[];
    educationHeading: string;
    educationInstitution: string;
    educationDetail: string;
    diplomaCta: string;
    resumeCta: string;
    capabilitiesLabel: string;
    capabilities: string[];
    profileAlt: string;
  };
  projects: {
    label: string;
    title: string;
    description: string;
    caseStudy: string;
    github: string;
    live: string;
    inDevelopment: string;
    videoPlaceholder: string;
    playLabel: string;
    pauseLabel: string;
    previousMediaLabel: string;
    nextMediaLabel: string;
  };
  services: {
    label: string;
    title: string;
    description: string;
    moreInfo: string;
    request: string;
    customLabel: string;
    customTitle: string;
    customDescription: string;
  };
  stack: {
    label: string;
    title: string;
    description: string;
  };
  contact: {
    label: string;
    title: string;
    description: string;
    emailLabel: string;
    emailPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    toastPlaceholder: string;
    linksLabel: string;
  };
  forms: {
    common: {
      name: string;
      namePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      phone: string;
      phoneHelper: string;
      phonePlaceholder: string;
      message: string;
      messageMaxHelper: string;
      messagePlaceholder: string;
      optional: string;
      requiredFieldsMessage: string;
      submit: string;
      retry: string;
      contactWhatsApp: string;
    };
    fields: {
      websiteUrl: string;
      websiteUrlHelper: string;
      websiteUrlPlaceholder: string;
      projectType: string;
      projectTypePersonal: string;
      projectTypeBusiness: string;
      brandName: string;
      brandNamePlaceholder: string;
      social: string;
      socialHelper: string;
      socialPlaceholder: string;
      automationType: string;
      automationCustomerService: string;
      automationBusinessProcesses: string;
      automationOther: string;
      business: string;
      businessPlaceholder: string;
      budget: string;
      budgetPlaceholder: string;
    };
    errors: {
      required: string;
      email: string;
      name: string;
      phone: string;
      url: string;
      messageMax: string;
      messageMin: string;
      brandRequired: string;
      submission: string;
    };
    success: {
      title: string;
      message: string;
      meeting: string;
      meetingUnavailable: string;
      whatsApp: string;
      emptyMessageFallback: string;
    };
  };
  modals: {
    comingSoonTitle: string;
    comingSoonMessage: string;
    closeLabel: string;
    contactCta: string;
    diplomaTitle: string;
    resumeTitle: string;
  };
  footer: {
    name: string;
    role: string;
    stack: string;
    copyrightPrefix: string;
  };
};

export const dictionaries: Record<Language, Dictionary> = {
  es: {
    meta: {
      siteName: "Nahuel Nicolas Noir",
      role: "Full-Stack Developer",
    },
    navigation: {
      about: "Sobre mí",
      projects: "Proyectos",
      services: "Servicios",
      stack: "Stack",
      contact: "Contacto",
      resume: "Resumen",
      changeToEnglish: "Change to English",
      changeToSpanish: "Cambiar a Español",
      lightTheme: "Tema Claro",
      darkTheme: "Tema Oscuro",
      homeLabel: "Ir al inicio",
      menuLabel: "Abrir menú",
      closeMenuLabel: "Cerrar menú",
      themeToggleLabel: "Cambiar tema",
      languageToggleLabel: "Cambiar idioma a inglés",
      primaryNavigationLabel: "Navegación principal",
      stickyNavigationLabel: "Navegación fija",
      mobileNavigationLabel: "Navegación móvil",
      drawerLabel: "Menú de navegación",
    },
    hero: {
      label: "FULL STACK DEVELOPER",
      headline: "Construyendo productos digitales desde la idea hasta producción.",
      italicFragment: "desde la idea",
      description:
        "Combino frontend, backend, diseño de producto y criterio técnico para transformar ideas, procesos y necesidades de negocio en software real: documentado, testeado y desplegado.",
      ctaContact: "Contacto",
      ctaProjects: "Ver proyectos",
      ctaServices: "Servicios",
      metric: "+3 años desarrollando software",
      metricPrefix: "+3",
      illustrationPhrase: "Creando soluciones digitales...",
    },
    about: {
      label: "— PERFIL",
      title: "Sobre mí",
      introHeading:
        "Soy Nahuel Noir, Full-Stack Developer enfocado en construir productos digitales desde la idea hasta producción.",
      paragraphs: [
        "Ayudo a transformar ideas, necesidades de negocio y procesos internos en software real: interfaces claras, flujos funcionales, lógica backend confiable y soluciones listas para desplegar.",
        "Mi trabajo empieza por entender el problema, definir qué necesita construirse y convertirlo en un producto útil, mantenible y preparado para crecer.",
        "Me importa crear experiencias limpias, arquitectura sólida y ejecución práctica. Ya sea una landing page, una plataforma e-commerce, una herramienta interna o una automatización, mi objetivo es construir software que se vea bien, funcione correctamente y resuelva una necesidad real.",
      ],
      educationHeading: "Educación — Técnico en Desarrollo de Software",
      educationInstitution: "Instituto Económico Nacional (I.E.N.)",
      educationDetail: "2023–2025 · Finalizado · GPA 8.50 / 10",
      diplomaCta: "Ver título",
      resumeCta: "Resumen",
      capabilitiesLabel: "CAPACIDADES END-TO-END",
      capabilities: [
        "Requisitos",
        "UI/UX",
        "Frontend",
        "Backend",
        "APIs",
        "Bases de datos",
        "Deploy",
        "Automatización",
        "AI Workflows",
      ],
      profileAlt: "Nahuel Noir",
    },
    projects: {
      label: "— PROYECTOS",
      title: "Trabajos seleccionados",
      description:
        "Productos reales construidos con foco en experiencia, arquitectura y funcionalidad end-to-end.",
      caseStudy: "Ver caso",
      github: "GitHub",
      live: "Ver caso",
      inDevelopment: "Actualmente en desarrollo...",
      videoPlaceholder: "Video placeholder del proyecto",
      playLabel: "Reproducir media",
      pauseLabel: "Pausar media",
      previousMediaLabel: "Ver media anterior",
      nextMediaLabel: "Ver media siguiente",
    },
    services: {
      label: "— SERVICIOS",
      title: "Servicios",
      description:
        "Soluciones digitales para negocios que necesitan verse mejor, vender más o automatizar procesos.",
      moreInfo: "Más info",
      request: "Solicitar",
      customLabel: "Personalizado",
      customTitle: "¿Necesitas software a medida?",
      customDescription:
        "Construyo soluciones específicas para procesos internos, MVPs, paneles administrativos o herramientas que no encajan en una plantilla estándar.",
    },
    stack: {
      label: "— STACK",
      title: "Toolbox",
      description: "Herramientas que uso para diseñar, construir, optimizar y desplegar productos digitales.",
    },
    contact: {
      label: "— CONTACTO",
      title: "Construyamos algo útil.",
      description: "",
      emailLabel: "Email",
      emailPlaceholder: "tu@email.com",
      messageLabel: "Mensaje",
      messagePlaceholder: "Cuéntame brevemente sobre tu proyecto…",
      submit: "Enviar mensaje",
      toastPlaceholder:
        "El formulario real estará disponible pronto. Mientras tanto, puedes escribirme por email o WhatsApp.",
      linksLabel: "Canales de contacto",
    },
    forms: {
      common: {
        name: "Nombre",
        namePlaceholder: "Tu nombre",
        email: "Correo",
        emailPlaceholder: "tu@email.com",
        phone: "WhatsApp / Teléfono",
        phoneHelper: "Ejemplo: +54 9 11 1234 5678",
        phonePlaceholder: "+54 9 11 1234 5678",
        message: "Mensaje",
        messageMaxHelper: "Máximo 500 caracteres.",
        messagePlaceholder: "Contame brevemente qué necesitás…",
        optional: "Opcional",
        requiredFieldsMessage: "Completá los campos obligatorios para enviar tu solicitud.",
        submit: "Enviar solicitud",
        retry: "Reintentar",
        contactWhatsApp: "Contactar por WhatsApp →",
      },
      fields: {
        websiteUrl: "Enlace de la web",
        websiteUrlHelper: "Ejemplo: https://tusitio.com",
        websiteUrlPlaceholder: "https://tusitio.com",
        projectType: "Tipo de proyecto",
        projectTypePersonal: "Personal",
        projectTypeBusiness: "Marca / empresa",
        brandName: "Nombre de marca / empresa",
        brandNamePlaceholder: "Nombre de tu marca o empresa",
        social: "Red social",
        socialHelper: "Se acepta URL o usuario.",
        socialPlaceholder: "https://instagram.com/tuusuario o @tuusuario",
        automationType: "Tipo de automatización",
        automationCustomerService: "Atención al cliente",
        automationBusinessProcesses: "Procesos del negocio",
        automationOther: "Otro",
        business: "Empresa / negocio",
        businessPlaceholder: "Nombre o rubro del negocio",
        budget: "Presupuesto",
        budgetPlaceholder: "$1000, USD 500, a definir…",
      },
      errors: {
        required: "Este campo es obligatorio.",
        email: "Ingresá un correo válido.",
        name: "Ingresá un nombre válido.",
        phone: "Ingresá un teléfono válido.",
        url: "Ingresá una URL válida.",
        messageMax: "El mensaje no puede superar los 500 caracteres.",
        messageMin: "El mensaje debe tener al menos 10 caracteres.",
        brandRequired: "Indicá el nombre de la marca o empresa.",
        submission: "No se pudo enviar la solicitud. Intentá nuevamente o contactame por WhatsApp.",
      },
      success: {
        title: "Solicitud enviada",
        message:
          "Recibí tu consulta. Para avanzar más rápido y no perder el contacto, podés continuar la conversación por WhatsApp.",
        meeting: "Agendar reunión",
        meetingUnavailable: "La agenda estará disponible en una próxima versión.",
        whatsApp: "Continuar por WhatsApp →",
        emptyMessageFallback: "Sin mensaje adicional",
      },
    },
    modals: {
      comingSoonTitle: "Próximamente",
      comingSoonMessage: "Este flujo estará disponible en una próxima versión.",
      closeLabel: "Cerrar modal",
      contactCta: "Ir a contacto",
      diplomaTitle: "Título",
      resumeTitle: "Resumen",
    },
    footer: {
      name: "Nahuel Nicolas Noir",
      role: "Full-Stack Developer",
      stack: "React · Next.js · TypeScript · Node.js",
      copyrightPrefix: "©",
    },
  },
  en: {
    meta: {
      siteName: "Nahuel Nicolas Noir",
      role: "Full-Stack Developer",
    },
    navigation: {
      about: "About Me",
      projects: "Projects",
      services: "Services",
      stack: "Stack",
      contact: "Contact",
      resume: "Resume",
      changeToEnglish: "Change to English",
      changeToSpanish: "Cambiar a Español",
      lightTheme: "Light Theme",
      darkTheme: "Dark Theme",
      homeLabel: "Go to top",
      menuLabel: "Open menu",
      closeMenuLabel: "Close menu",
      themeToggleLabel: "Toggle theme",
      languageToggleLabel: "Change language to Spanish",
      primaryNavigationLabel: "Primary navigation",
      stickyNavigationLabel: "Sticky navigation",
      mobileNavigationLabel: "Mobile navigation",
      drawerLabel: "Navigation menu",
    },
    hero: {
      label: "FULL STACK DEVELOPER",
      headline: "Building digital products from idea to production.",
      italicFragment: "from idea",
      description:
        "I combine frontend, backend, product design, and technical judgment to turn ideas, processes, and business needs into real software: documented, tested, and deployed.",
      ctaContact: "Contact",
      ctaProjects: "View projects",
      ctaServices: "Services",
      metric: "+3 years building software",
      metricPrefix: "+3",
      illustrationPhrase: "Crafting digital solutions...",
    },
    about: {
      label: "— PROFILE",
      title: "About Me",
      introHeading:
        "I'm Nahuel Noir, a Full-Stack Developer focused on building digital products from idea to production.",
      paragraphs: [
        "I help turn ideas, business needs and internal processes into real software: clear interfaces, functional workflows, reliable backend logic and deployable solutions.",
        "My work starts by understanding the problem, defining what needs to be built and then shaping it into a product that is useful, maintainable and ready to grow.",
        "I care about clean user experiences, solid architecture and practical execution. Whether it is a landing page, an e-commerce platform, an internal tool or an automation, my goal is to build software that looks good, works well and solves a real need.",
      ],
      educationHeading: "Education — Software Development Technician",
      educationInstitution: "Instituto Económico Nacional (I.E.N.)",
      educationDetail: "2023–2025 · Completed · GPA 8.50 / 10",
      diplomaCta: "View diploma",
      resumeCta: "Resume",
      capabilitiesLabel: "END-TO-END CAPABILITIES",
      capabilities: [
        "Requirements",
        "UI/UX",
        "Frontend",
        "Backend",
        "APIs",
        "Databases",
        "Deploy",
        "Automation",
        "AI Workflows",
      ],
      profileAlt: "Nahuel Noir",
    },
    projects: {
      label: "— WORK",
      title: "Selected work",
      description: "Real products built with focus on experience, architecture and end-to-end functionality.",
      caseStudy: "Case study",
      github: "GitHub",
      live: "Case study",
      inDevelopment: "Currently in development...",
      videoPlaceholder: "Project video placeholder",
      playLabel: "Play media",
      pauseLabel: "Pause media",
      previousMediaLabel: "View previous media",
      nextMediaLabel: "View next media",
    },
    services: {
      label: "— SERVICES",
      title: "Services",
      description: "Digital solutions for businesses that need to look better, sell more, or automate processes.",
      moreInfo: "More info",
      request: "Request",
      customLabel: "CUSTOM",
      customTitle: "Need custom software?",
      customDescription:
        "I build specific solutions for internal processes, MVPs, admin dashboards, or tools that do not fit a standard template.",
    },
    stack: {
      label: "— STACK",
      title: "Toolbox",
      description: "Tools I use to design, build, optimize and ship digital products.",
    },
    contact: {
      label: "— CONTACT",
      title: "Let's build something useful.",
      description: "",
      emailLabel: "Email",
      emailPlaceholder: "you@email.com",
      messageLabel: "Message",
      messagePlaceholder: "Tell me briefly about your project…",
      submit: "Send message",
      toastPlaceholder:
        "The real form will be available soon. In the meantime, you can contact me by email or WhatsApp.",
      linksLabel: "Contact channels",
    },
    forms: {
      common: {
        name: "Name",
        namePlaceholder: "Your name",
        email: "Email",
        emailPlaceholder: "you@email.com",
        phone: "WhatsApp / Phone",
        phoneHelper: "Example: +1 555 123 4567",
        phonePlaceholder: "+1 555 123 4567",
        message: "Message",
        messageMaxHelper: "Maximum 500 characters.",
        messagePlaceholder: "Tell me briefly what you need…",
        optional: "Optional",
        requiredFieldsMessage: "Complete the required fields to send your request.",
        submit: "Send request",
        retry: "Retry",
        contactWhatsApp: "Contact via WhatsApp →",
      },
      fields: {
        websiteUrl: "Website URL",
        websiteUrlHelper: "Example: https://yoursite.com",
        websiteUrlPlaceholder: "https://yoursite.com",
        projectType: "Project type",
        projectTypePersonal: "Personal",
        projectTypeBusiness: "Brand / company",
        brandName: "Brand / company name",
        brandNamePlaceholder: "Your brand or company name",
        social: "Social profile",
        socialHelper: "URL or username is accepted.",
        socialPlaceholder: "https://instagram.com/youruser or @youruser",
        automationType: "Automation type",
        automationCustomerService: "Customer service",
        automationBusinessProcesses: "Business processes",
        automationOther: "Other",
        business: "Company / business",
        businessPlaceholder: "Business name or industry",
        budget: "Budget",
        budgetPlaceholder: "$1000, USD 500, to define…",
      },
      errors: {
        required: "This field is required.",
        email: "Enter a valid email address.",
        name: "Enter a valid name.",
        phone: "Enter a valid phone number.",
        url: "Enter a valid URL.",
        messageMax: "The message cannot exceed 500 characters.",
        messageMin: "The message must be at least 10 characters.",
        brandRequired: "Enter the brand or company name.",
        submission: "The request could not be sent. Try again or contact me on WhatsApp.",
      },
      success: {
        title: "Request sent",
        message:
          "I received your request. To move faster and keep the conversation going, you can continue on WhatsApp.",
        meeting: "Schedule meeting",
        meetingUnavailable: "Scheduling will be available in a future version.",
        whatsApp: "Continue on WhatsApp →",
        emptyMessageFallback: "No additional message",
      },
    },
    modals: {
      comingSoonTitle: "Coming soon",
      comingSoonMessage: "This flow will be available in a future version.",
      closeLabel: "Close modal",
      contactCta: "Go to contact",
      diplomaTitle: "Diploma",
      resumeTitle: "Resume",
    },
    footer: {
      name: "Nahuel Nicolas Noir",
      role: "Full-Stack Developer",
      stack: "React · Next.js · TypeScript · Node.js",
      copyrightPrefix: "©",
    },
  },
};

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "nn-lang";
export const LANGUAGE_CHANGE_EVENT = "nn-lang-change";

export function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function normalizeLanguage(value: string | null | undefined): Language {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const baseLanguage = value.toLowerCase().split("-")[0];

  return isLanguage(baseLanguage) ? baseLanguage : DEFAULT_LANGUAGE;
}

export function detectBrowserLanguage(navigatorLanguage?: string): Language {
  return normalizeLanguage(navigatorLanguage);
}

export function getDictionary(language: Language): Dictionary {
  return dictionaries[language];
}
