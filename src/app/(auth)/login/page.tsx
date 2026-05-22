export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
        <h1 className="text-center text-2xl font-bold">Sign in to SoonSnap</h1>
        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Sign In
          </button>
        </form>
        <p className="text-center text-xs text-neutral-500">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-purple-400 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
