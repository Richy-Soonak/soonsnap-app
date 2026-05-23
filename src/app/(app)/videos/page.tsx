import { Film } from 'lucide-react'

export default function VideosPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">My Videos</h1>
      <p className="text-[#999] text-sm mb-10">All your rendered videos in one place</p>
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Film size={40} className="mx-auto text-[#444] mb-4" />
        <h3 className="text-lg font-medium mb-2">Coming in Stage 3</h3>
        <p className="text-[#999] text-sm">Version timeline, video player, and project management</p>
      </div>
    </div>
  )
}
