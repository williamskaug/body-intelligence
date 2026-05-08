import Link from "next/link";

export const metadata = { title: "Terms — Body Intelligence" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Body Intelligence
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-05-08</p>

      <div className="prose prose-sm mt-8 max-w-none text-sm leading-relaxed">
        <p>
          Body Intelligence is a personal data store for athletes — a place to
          log your training, sleep, meals, and wellness check-ins, and to keep
          a small markdown memory layer that Claude reads when reasoning about
          your training.
        </p>
        <h2 className="mt-8 text-base font-semibold">Your data is yours</h2>
        <p>
          Body Intelligence does not analyze, train on, or sell your data.
          Reasoning about your data happens in your Claude conversations, not
          inside this app. You can export or delete everything at any time
          from Settings.
        </p>
        <h2 className="mt-6 text-base font-semibold">Accounts</h2>
        <p>
          One account per real person. Don&apos;t use this for clinical,
          regulated, or safety-critical decisions — it&apos;s a personal
          journal, not a medical device.
        </p>
        <h2 className="mt-6 text-base font-semibold">Service availability</h2>
        <p>
          Provided as-is, without warranty. We aim for uptime but do not
          guarantee it. Take backups of anything you can&apos;t afford to
          lose.
        </p>
      </div>
    </main>
  );
}
