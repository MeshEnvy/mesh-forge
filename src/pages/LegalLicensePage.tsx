import MarkdownDoc from '../components/MarkdownDoc'
import content from '../content/license.md?raw'

export default function LegalLicensePage() {
  return <MarkdownDoc markdown={content} />
}
