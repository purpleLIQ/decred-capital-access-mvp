import { SigningSessionPanel } from "@/components/signing-session-panel";

export default function SigningSessionsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 text-[#17211d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 border-b border-[#d8dfda] pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#577067]">Operator console</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Signing sessions</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#577067]">
            Demo surface for collecting externally signed transaction hex. This page does not sign, broadcast, unlock wallets,
            store private keys, call wallet RPC, or execute liquidation.
          </p>
        </header>
        <SigningSessionPanel review={null} />
      </div>
    </main>
  );
}
