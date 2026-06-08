import Link from "next/link";
import { DemoConsole } from "@/components/demo-console";

export default function ConsolePage() {
  return (
    <>
      <Link
        className="fixed right-4 top-4 z-50 rounded-full border border-[#ccd6d0] bg-white px-3 py-2 text-sm font-semibold text-[#17211d] shadow-lg hover:bg-[#eef3f0]"
        href="/signing-sessions"
      >
        Signing sessions
      </Link>
      <DemoConsole />
    </>
  );
}
