import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MediCrew",
  url: "https://www.medicrew.app",
  logo: "https://www.medicrew.app/favicon.ico",
  description:
    "International network connecting verified doctors and nurses with medical transport, repatriation and event healthcare organizations.",
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <meta name="theme-color" content="#08785C" />
        <meta name="application-name" content="MediCrew" />
        <meta property="og:site_name" content="MediCrew" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.medicrew.app/" />
        <meta property="og:title" content="MediCrew — Care moves forward" />
        <meta
          property="og:description"
          content="Verified medical professionals for transport, repatriation and event healthcare missions."
        />
        <meta
          property="og:image"
          content="https://www.medicrew.app/favicon.ico"
        />
        <meta name="twitter:card" content="summary" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
