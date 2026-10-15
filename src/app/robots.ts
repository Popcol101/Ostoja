import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/r/", "/logowanie", "/api", "/styleguide"] },
  };
}
