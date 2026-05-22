export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">SoonSnap Dashboard</h1>
      <p className="text-neutral-500">
        Your videos and projects will appear here.
      </p>
      <a
        href="/editor"
        className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-700"
      >
        + New Video
      </a>
    </div>
  );
}
