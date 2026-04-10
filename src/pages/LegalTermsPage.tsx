import MarkdownDoc from '../components/MarkdownDoc'
import content from '../content/terms.md?raw'

export default function LegalTermsPage() {
  return <MarkdownDoc markdown={content} />
}
