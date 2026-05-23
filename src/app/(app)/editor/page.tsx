import { Film } from 'lucide-react'

export default function EditorPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Video Editor</h1>
      <p className="text-[#999] text-sm mb-10">Paste a URL and create a video</p>
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Film size={40} className="mx-auto text-[#444] mb-4" />
        <h3 className="text-lg font-medium mb-2">Coming in Stage 2</h3>
        <p className="text-[#999] text-sm">URL input, design token capture, and render pipeline</p>
      </div>
    </div>
  )
}
