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
    errorMessage: string;
    successMessage: string;
    linksLabel: string;
  };
  meeting: {
    title: string;
    descriptionFromService: string;
    descriptionFromContact: string;
    disclaimer: string;
    fields: {
      name: string;
      email: string;
      phone: string;
      reason: string;
      message: string;
      date: string;
      time: string;
    };
    dateTime: {
      title: string;
      open: string;
      selected: string;
      previousMonth: string;
      nextMonth: string;
      calendarLabel: string;
      timezoneLabel: string;
      confirm: string;
      cancel: string;
    };
    reasons: {
      project: string;
      job: string;
      general: string;
    };
    actions: {
      confirm: string;
      loading: string;
      back: string;
      backToForm: string;
      close: string;
      retry: string;
      whatsapp: string;
    };
    availability: {
      loading: string;
      empty: string;
      error: string;
    };
    success: {
      title: string;
      message: string;
    };
    error: {
      title: string;
      message: string;
      slotUnavailable: string;
    };
    contact: {
      title: string;
      subtitle: string;
      cta: string;
    };
    whatsapp: {
      intro: string;
      service: string;
      name: string;
      email: string;
      phone: string;
      reason: string;
      schedule: string;
      message: string;
    };
  };
  meet: {
    action: {
      title: string;
      confirm: string;
      propose: string;
      decline: string;
      acceptProposal: string;
      invalid: string;
      expired: string;
      unavailable: string;
      success: string;
      replay: string;
      error: string;
      submit: string;
      submitting: string;
      backHome: string;
      proposalDescription: string;
      proposalSelectSlot: string;
      proposalSelectedSlot: string;
      proposalSlotUnverified: string;
      proposalSlotUnavailable: string;
      proposalInvalid: string;
      proposalLinkNotActive: string;
      proposalTemporarilyUnavailable: string;
      proposalSuccessDescription: string;
      proposalReplayDescription: string;
      confirmDescription: string;
      declineDescription: string;
      declineReasonLabel: string;
      declineReasonHint: string;
      acceptProposalDescription: string;
      actionSuccessDescription: string;
      actionReplayDescription: string;
      actionTemporarilyUnavailable: string;
      actionDeliveryWarningDescription: string;
      deliveryWarning: string;
      proposalDeliveryWarningDescription: string;
    };
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
      dateRequired: string;
      timeRequired: string;
      phoneRequired: string;
      reasonRequired: string;
      slotUnavailable: string;
      timezoneRequired: string;
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
    closeLabel: string;
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
      errorMessage: "No se pudo enviar el mensaje. Intentá nuevamente o escribime por WhatsApp.",
      successMessage: "Recibí tu mensaje. Te responderé pronto.",
      linksLabel: "Canales de contacto",
    },
    meeting: {
      title: "Agendar llamada",
      descriptionFromService: "Elegí un día y horario disponible para solicitar una reunión sobre tu proyecto.",
      descriptionFromContact:
        "Completá tus datos y elegí un horario disponible para solicitar una reunión breve.",
      disclaimer:
        "La reunión quedará pendiente de confirmación. Si el horario sigue disponible, te voy a enviar la convocatoria con el enlace de Google Meet.",
      fields: {
        name: "Nombre",
        email: "Email",
        phone: "WhatsApp / Teléfono",
        reason: "Motivo de la llamada",
        message: "Mensaje adicional",
        date: "Fecha",
        time: "Horario disponible",
      },
      dateTime: {
        title: "Elegí fecha y horario",
        open: "Elegir fecha y horario",
        selected: "Horario seleccionado",
        previousMonth: "Mes anterior",
        nextMonth: "Mes siguiente",
        calendarLabel: "Calendario de disponibilidad",
        timezoneLabel: "Horario local",
        confirm: "Confirmar horario",
        cancel: "Cancelar",
      },
      reasons: {
        project: "Proyecto / servicio",
        job: "Oportunidad laboral",
        general: "Consulta general",
      },
      actions: {
        confirm: "Confirmar solicitud",
        loading: "Solicitando reunión...",
        back: "Volver",
        backToForm: "Volver al formulario",
        close: "Cerrar",
        retry: "Reintentar",
        whatsapp: "Continuar por WhatsApp →",
      },
      availability: {
        loading: "Buscando horarios disponibles...",
        empty: "No hay horarios disponibles para este día. Elegí otra fecha.",
        error:
          "No se pudieron cargar los horarios disponibles. Intentá nuevamente o contactame por WhatsApp.",
      },
      success: {
        title: "Reunión solicitada con éxito",
        message:
          "Recibí tu solicitud. En las próximas horas voy a confirmar la disponibilidad y enviarte la convocatoria con el enlace de Google Meet, o te voy a proponer otro horario.",
      },
      error: {
        title: "Error al solicitar reunión",
        message: "No se pudo solicitar la reunión. Intentá nuevamente o contactame por WhatsApp.",
        slotUnavailable: "Ese horario ya no está disponible. Elegí otro horario para solicitar la reunión.",
      },
      contact: {
        title: "¿Te interesa mi perfil o alguno de mis servicios?",
        subtitle: "Agendemos una llamada breve para conversar próximos pasos.",
        cta: "Agendar llamada",
      },
      whatsapp: {
        intro: "Hola Nahuel, quiero solicitar una reunión.",
        service: "Servicio",
        name: "Nombre",
        email: "Correo",
        phone: "WhatsApp",
        reason: "Motivo",
        schedule: "Horario solicitado",
        message: "Mensaje",
      },
    },
    meet: {
      action: {
        title: "Acción de reunión",
        confirm: "Confirmar reunión",
        propose: "Proponer otro horario",
        decline: "Rechazar reunión",
        acceptProposal: "Aceptar horario propuesto",
        invalid: "Este enlace no es válido",
        expired: "Este enlace venció",
        unavailable: "La acción no está disponible",
        success: "Acción completada",
        replay: "Esta acción ya fue completada",
        error: "No se pudo completar la acción",
        submit: "Continuar",
        submitting: "Procesando…",
        backHome: "Volver al portfolio",
        proposalDescription: "Elegí un nuevo día y horario disponible para enviar una propuesta.",
        proposalSelectSlot: "Elegí un día y horario disponible.",
        proposalSelectedSlot: "Horario propuesto",
        proposalSlotUnverified: "No podemos confirmar este horario en este momento. Elegí otro horario o intentá más tarde.",
        proposalSlotUnavailable: "Este horario ya no está disponible. Elegí otro horario.",
        proposalInvalid: "No se pudo validar el horario seleccionado. Elegí otro horario e intentá nuevamente.",
        proposalLinkNotActive: "Este enlace no es válido, venció o ya fue utilizado.",
        proposalTemporarilyUnavailable: "No se pudo enviar la propuesta en este momento. Intentá nuevamente más tarde.",
        proposalSuccessDescription: "La nueva propuesta fue enviada correctamente.",
        proposalReplayDescription: "Esta propuesta ya había sido enviada. No se realizó ningún cambio adicional.",
        confirmDescription: "Confirmá esta reunión para reservar el horario seleccionado.",
        declineDescription: "Podés rechazar esta reunión. El motivo es opcional.",
        declineReasonLabel: "Motivo del rechazo",
        declineReasonHint: "Opcional. Compartí contexto útil para la otra persona.",
        acceptProposalDescription: "Aceptá el horario propuesto para confirmar la reunión.",
        actionSuccessDescription: "La acción se completó correctamente.",
        actionReplayDescription: "Esta acción ya había sido completada. No se realizó ningún cambio adicional.",
        actionTemporarilyUnavailable: "No se pudo completar esta acción en este momento. Intentá nuevamente más tarde.",
        actionDeliveryWarningDescription: "La acción fue guardada, pero no se pudo confirmar la entrega de seguimiento.",
        deliveryWarning: "Entrega sin confirmar",
        proposalDeliveryWarningDescription: "La propuesta fue guardada, pero no se pudo confirmar la entrega de la notificación.",
      },
    },
    forms: {
      common: {
        name: "Nombre",
        namePlaceholder: "Coloca tu nombre completo",
        email: "Correo",
        emailPlaceholder: "Coloca tu mail principal",
        phone: "WhatsApp / Teléfono",
        phoneHelper: "Ejemplo: +54 9 11 1234 5678",
        phonePlaceholder: "Coloca tu WhatsApp o teléfono",
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
        websiteUrlPlaceholder: "Coloca la URL de tu sitio web",
        projectType: "Tipo de proyecto",
        projectTypePersonal: "Personal",
        projectTypeBusiness: "Marca / empresa",
        brandName: "Nombre de marca / empresa",
        brandNamePlaceholder: "Coloca el nombre de tu marca o empresa",
        social: "Red social",
        socialHelper: "Se acepta URL o usuario.",
        socialPlaceholder: "Coloca tu perfil o @usuario",
        automationType: "Tipo de automatización",
        automationCustomerService: "Atención al cliente",
        automationBusinessProcesses: "Procesos del negocio",
        automationOther: "Otro",
        business: "Empresa / negocio",
        businessPlaceholder: "Coloca el nombre o rubro del negocio",
        budget: "Presupuesto",
        budgetPlaceholder: "Ej: $1000, USD 500, a definir…",
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
        dateRequired: "Seleccioná una fecha.",
        timeRequired: "Seleccioná un horario.",
        phoneRequired: "Ingresá un WhatsApp o teléfono de contacto.",
        reasonRequired: "Seleccioná un motivo.",
        slotUnavailable: "Ese horario ya no está disponible.",
        timezoneRequired: "No se pudo identificar una zona horaria válida.",
      },
      success: {
        title: "Solicitud enviada",
        message:
          "Recibí tu consulta. Para avanzar más rápido y no perder el contacto, podés continuar la conversación por WhatsApp.",
        meeting: "Agendar llamada",
        meetingUnavailable: "Agendá una reunión directamente desde el portfolio — próximamente",
        whatsApp: "Continuar por WhatsApp →",
        emptyMessageFallback: "Sin mensaje adicional",
      },
    },
    modals: {
      closeLabel: "Cerrar modal",
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
      errorMessage: "Your message could not be sent. Try again or contact me on WhatsApp.",
      successMessage: "I received your message. I will get back to you soon.",
      linksLabel: "Contact channels",
    },
    meeting: {
      title: "Schedule a call",
      descriptionFromService: "Choose an available day and time to request a meeting about your project.",
      descriptionFromContact:
        "Complete your details and choose an available time to request a brief meeting.",
      disclaimer:
        "The meeting will be pending confirmation. If the time is still available, I'll send you the invite with the Google Meet link.",
      fields: {
        name: "Name",
        email: "Email",
        phone: "WhatsApp / Phone",
        reason: "Call reason",
        message: "Additional message",
        date: "Date",
        time: "Available time",
      },
      dateTime: {
        title: "Choose a date and time",
        open: "Choose date and time",
        selected: "Selected time",
        previousMonth: "Previous month",
        nextMonth: "Next month",
        calendarLabel: "Availability calendar",
        timezoneLabel: "Local time",
        confirm: "Confirm time",
        cancel: "Cancel",
      },
      reasons: {
        project: "Project / service",
        job: "Job opportunity",
        general: "General inquiry",
      },
      actions: {
        confirm: "Confirm request",
        loading: "Requesting meeting...",
        back: "Back",
        backToForm: "Back to form",
        close: "Close",
        retry: "Retry",
        whatsapp: "Continue on WhatsApp →",
      },
      availability: {
        loading: "Searching available times...",
        empty: "No available times for this day. Choose another date.",
        error: "Could not load available times. Try again or contact me on WhatsApp.",
      },
      success: {
        title: "Meeting request sent successfully",
        message:
          "I received your request. In the next few hours I'll confirm availability and send you the invite with the Google Meet link, or I'll propose another time.",
      },
      error: {
        title: "Error requesting meeting",
        message: "Could not request the meeting. Try again or contact me on WhatsApp.",
        slotUnavailable: "That time is no longer available. Choose another time to request the meeting.",
      },
      contact: {
        title: "Interested in my profile or services?",
        subtitle: "Let's schedule a brief call to discuss next steps.",
        cta: "Schedule a call",
      },
      whatsapp: {
        intro: "Hi Nahuel, I want to request a meeting.",
        service: "Service",
        name: "Name",
        email: "Email",
        phone: "WhatsApp",
        reason: "Reason",
        schedule: "Requested time",
        message: "Message",
      },
    },
    meet: {
      action: {
        title: "Meeting action",
        confirm: "Confirm meeting",
        propose: "Propose another time",
        decline: "Decline meeting",
        acceptProposal: "Accept proposed time",
        invalid: "This link is invalid",
        expired: "This link has expired",
        unavailable: "This action is unavailable",
        success: "Action completed",
        replay: "This action was already completed",
        error: "The action could not be completed",
        submit: "Continue",
        submitting: "Processing…",
        backHome: "Back to portfolio",
        proposalDescription: "Choose a new available day and time to send a proposal.",
        proposalSelectSlot: "Choose an available day and time.",
        proposalSelectedSlot: "Proposed time",
        proposalSlotUnverified: "We cannot verify this time right now. Choose another time or try again later.",
        proposalSlotUnavailable: "This time is no longer available. Choose another time.",
        proposalInvalid: "The selected time could not be validated. Choose another time and try again.",
        proposalLinkNotActive: "This link is invalid, expired, or has already been used.",
        proposalTemporarilyUnavailable: "The proposal could not be sent right now. Try again later.",
        proposalSuccessDescription: "The new proposal was sent successfully.",
        proposalReplayDescription: "This proposal was already sent. No additional change was made.",
        confirmDescription: "Confirm this meeting to reserve the selected time.",
        declineDescription: "You can decline this meeting. A reason is optional.",
        declineReasonLabel: "Decline reason",
        declineReasonHint: "Optional. Share helpful context with the other person.",
        acceptProposalDescription: "Accept the proposed time to confirm the meeting.",
        actionSuccessDescription: "The action was completed successfully.",
        actionReplayDescription: "This action was already completed. No additional change was made.",
        actionTemporarilyUnavailable: "This action could not be completed right now. Try again later.",
        actionDeliveryWarningDescription: "The action was saved, but follow-up delivery could not be confirmed.",
        deliveryWarning: "Delivery unconfirmed",
        proposalDeliveryWarningDescription: "The proposal was saved, but notification delivery could not be confirmed.",
      },
    },
    forms: {
      common: {
        name: "Name",
        namePlaceholder: "Enter your full name",
        email: "Email",
        emailPlaceholder: "Enter your main email",
        phone: "WhatsApp / Phone",
        phoneHelper: "Example: +1 555 123 4567",
        phonePlaceholder: "Enter your WhatsApp or phone",
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
        websiteUrlPlaceholder: "Enter your website URL",
        projectType: "Project type",
        projectTypePersonal: "Personal",
        projectTypeBusiness: "Brand / company",
        brandName: "Brand / company name",
        brandNamePlaceholder: "Enter your brand or company name",
        social: "Social profile",
        socialHelper: "URL or username is accepted.",
        socialPlaceholder: "Enter your profile or @username",
        automationType: "Automation type",
        automationCustomerService: "Customer service",
        automationBusinessProcesses: "Business processes",
        automationOther: "Other",
        business: "Company / business",
        businessPlaceholder: "Enter your business name or industry",
        budget: "Budget",
        budgetPlaceholder: "e.g. $1000, USD 500, to define…",
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
        dateRequired: "Select a date.",
        timeRequired: "Select a time.",
        phoneRequired: "Enter a WhatsApp number or contact phone.",
        reasonRequired: "Select a reason.",
        slotUnavailable: "That time is no longer available.",
        timezoneRequired: "A valid time zone could not be identified.",
      },
      success: {
        title: "Request sent",
        message:
          "I received your request. To move faster and keep the conversation going, you can continue on WhatsApp.",
        meeting: "Schedule a call",
        meetingUnavailable: "Schedule a meeting directly from the portfolio — coming soon",
        whatsApp: "Continue on WhatsApp →",
        emptyMessageFallback: "No additional message",
      },
    },
    modals: {
      closeLabel: "Close modal",
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
