import Link from "next/link";

export default function AuthError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Authentication Error
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Something went wrong during sign in. Please try again.
        </p>
        <Link
          href="/"
          className="mt-4 rounded-full bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
