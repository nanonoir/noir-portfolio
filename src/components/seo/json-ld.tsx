import { localeUrl, SEO_ORIGIN } from "@/lib/locale-routing";

const personId = `${SEO_ORIGIN}/#person`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": personId,
      "@type": "Person",
      alternateName: "Nahuel Noir",
      jobTitle: "Full-Stack Developer",
      knowsAbout: ["React", "Next.js", "JavaScript", "TypeScript", "Node.js", "PostgreSQL", "Docker"],
      name: "Nahuel Nicolas Noir",
      sameAs: ["https://www.linkedin.com/in/nahuelnicolasnoir/", "https://github.com/nanonoir"],
      url: localeUrl("es").toString(),
    },
    {
      "@id": `${SEO_ORIGIN}/#website`,
      "@type": "WebSite",
      name: "Nahuel Nicolas Noir",
      publisher: { "@id": personId },
      url: localeUrl("es").toString(),
    },
  ],
};

export function PersonWebSiteJsonLd() {
  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} type="application/ld+json" />;
}
