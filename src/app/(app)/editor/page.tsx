export default function EditorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Video Editor</h1>
      <p className="text-neutral-500">
        Enter a URL and generate a cinematic video.
      </p>
      <div className="flex w-full max-w-lg gap-2">
        <input
          type="url"
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          Capture
        </button>
      </div>
    </div>
  );
}
