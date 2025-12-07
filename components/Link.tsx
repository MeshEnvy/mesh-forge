import { usePageContext } from "vike-react/usePageContext";
import type { ReactNode } from "react";

export function Link({ href, children }: { href: string; children: ReactNode }) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/" ? urlPathname === href : urlPathname.startsWith(href);
  return (
    <a href={href} className={isActive ? "is-active" : undefined}>
      {children}
    </a>
  );
}
