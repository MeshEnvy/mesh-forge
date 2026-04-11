import appleTouchIconUrl from "@/assets/apple-touch-icon.png?url"
import favicon96x96Url from "@/assets/favicon-96x96.png?url"
import faviconIcoUrl from "@/assets/favicon.ico?url"
import faviconSvgUrl from "@/assets/favicon.svg?url"
import logoUrl from "@/assets/logo.png?url"
import webAppIcon192Url from "@/assets/web-app-manifest-192x192.png?url"
import webAppIcon512Url from "@/assets/web-app-manifest-512x512.png?url"

const headMarker = "link[data-mesh-forge-head]"

function appendLink(attrs: Record<string, string>) {
  const el = document.createElement('link')
  el.setAttribute("data-mesh-forge-head", "")
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v)
  }
  document.head.appendChild(el)
}

/** Mirrors `main:pages/+Head.tsx` for the Vite SPA (tab icon, install manifest, etc.). */
export function bootstrapAppHead() {
  if (document.head.querySelector(headMarker)) return

  appendLink({ rel: 'icon', type: 'image/png', href: favicon96x96Url, sizes: '96x96' })
  appendLink({ rel: 'icon', type: 'image/svg+xml', href: faviconSvgUrl })
  appendLink({ rel: 'shortcut icon', href: faviconIcoUrl })
  appendLink({ rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIconUrl })
  appendLink({ rel: 'icon', href: logoUrl })

  const manifest = {
    name: "Mesh Forge",
    short_name: "Mesh Forge",
    icons: [
      {
        src: webAppIcon192Url,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: webAppIcon512Url,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone" as const,
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" })
  const manifestUrl = URL.createObjectURL(blob)
  appendLink({ rel: 'manifest', href: manifestUrl })
}
