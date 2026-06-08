# Signing Route Wrapper Patch

The GitHub connector blocked direct writes to `src/app/api/**/route.ts`. The route logic is already implemented and tested in `src/lib/signing-session-api-handlers.ts`. Add these thin wrappers locally.

## File 1

Create:

```text
src/app/api/signing-sessions/route.ts
```

With:

```ts
import { NextResponse } from "next/server";
import { handleCreateSigningSession, handleListSigningSessions } from "@/lib/signing-session-api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = handleListSigningSessions();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const result = handleCreateSigningSession(await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
```

## File 2

Create:

```text
src/app/api/signing-sessions/submissions/route.ts
```

With:

```ts
import { NextResponse } from "next/server";
import { handleAddSigningSubmission } from "@/lib/signing-session-api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const result = handleAddSigningSubmission(await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
```

## Verify

After adding both files locally, run:

```bash
npm run verify
```

## Safety Boundary

These wrappers do not sign, broadcast, unlock wallets, handle private keys, call RPC, or execute liquidation. They only call the already-tested handler helpers.
