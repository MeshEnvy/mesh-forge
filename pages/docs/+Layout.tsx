import { Link } from "../../components/Link";
import { usePageContext } from "vike-react/usePageContext";

const navSections = [
  {
    items: [{ href: "/docs", label: "Overview" }],
  },
  {
    heading: "Plugins",
    items: [
      { href: "/docs/registry", label: "Overview" },
      { href: "/docs/plugin-authoring", label: "Authoring Guide" },
    ],
  },
  {
    heading: "Flashing",
    items: [
      { href: "/docs/esp32", label: "ESP32" },
      { href: "/docs/nRF52", label: "nRF52" },
    ],
  },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/docs" ? urlPathname === href : urlPathname.startsWith(href);

  return (
    <Link href={href}>
      <span
        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-secondary text-secondary-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8 max-w-7xl mx-auto px-6 py-8">
      <aside className="w-64 shrink-0">
        <nav className="sticky top-8">
          <ul className="space-y-4">
            {navSections.map((section, sectionIndex) => (
              <li key={sectionIndex}>
                {section.heading && (
                  <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.heading}
                  </h3>
                )}
                <ul className="space-y-1 mt-1">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <NavLink href={item.href} label={item.label} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <article className="prose prose-invert lg:prose-xl max-w-none">{children}</article>
      </main>
    </div>
  );
}
