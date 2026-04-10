import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

export default function MarkdownDoc({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12 text-slate-200 prose prose-invert prose-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('/'))
              return (
                <Link to={href} {...props}>
                  {children}
                </Link>
              )
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
