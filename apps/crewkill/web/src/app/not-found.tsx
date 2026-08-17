import Link from "next/link";

/**
 * A branded 404 with a way back, rather than the framework's default.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5">
      <div className="tele">404</div>
      <h1 className="macro macro-lg mt-3">Nobody here</h1>
      <p className="mt-4 max-w-md text-[13px] leading-relaxed text-[var(--color-dim)]">
        That page does not exist. The ship does.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className="switch switch-primary no-underline">
          Back to the ship
        </Link>
        <Link href="/history" className="switch no-underline">
          Archive
        </Link>
      </div>
    </main>
  );
}
