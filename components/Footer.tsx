export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 mt-auto">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
          <a href="/license" className="hover:text-white transition-colors">
            License
          </a>
          <span className="text-slate-600">•</span>
          <a href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </a>
          <span className="text-slate-600">•</span>
          <a href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  )
}
