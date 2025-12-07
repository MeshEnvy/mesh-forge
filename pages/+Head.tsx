// https://vike.dev/Head

import appleTouchIconUrl from "@/assets/apple-touch-icon.png"
import favicon96x96Url from "@/assets/favicon-96x96.png"
import faviconIcoUrl from "@/assets/favicon.ico"
import faviconUrl from "@/assets/favicon.svg"
import logoUrl from "@/assets/logo.png"
import siteWebmanifestUrl from "@/assets/site.webmanifest"

export function Head() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/png" href={favicon96x96Url} sizes="96x96" />
      <link rel="icon" type="image/svg+xml" href={faviconUrl} />
      <link rel="shortcut icon" href={faviconIcoUrl} />
      <link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconUrl} />
      <link rel="manifest" href={siteWebmanifestUrl} />
      <link rel="icon" href={logoUrl} />
    </>
  )
}
