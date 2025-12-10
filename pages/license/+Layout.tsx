export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <article className="prose prose-invert lg:prose-xl max-w-none">{children}</article>
    </div>
  )
}
