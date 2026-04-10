import MarkdownDoc from '../components/MarkdownDoc'
import content from '../content/privacy.md?raw'

export default function LegalPrivacyPage() {
  return <MarkdownDoc markdown={content} />
}
