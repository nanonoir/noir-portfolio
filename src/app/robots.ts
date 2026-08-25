import type { MetadataRoute } from "next";
import { SEO_ORIGIN } from "@/lib/locale-routing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/en", "/es"], disallow: ["/api", "/meetings"] },
    sitemap: `${SEO_ORIGIN}/sitemap.xml`,
  };
}
