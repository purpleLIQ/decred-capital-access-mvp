import fs from "fs";
import path from "path";
import type { SimnetProofSession } from "./simnet-proof-readiness";

export interface SimnetProofSessionStore {
  upsert(session: SimnetProofSession): Promise<SimnetProofSession>;
  findById(proofSessionId: string): Promise<SimnetProofSession | null>;
  listByLookupCode(lookupCode: string, limit?: number): Promise<SimnetProofSession[]>;
  listRecent(limit?: number): Promise<SimnetProofSession[]>;
}

type StoreFile = {
  sessions: SimnetProofSession[];
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "simnet-proof-sessions.json");
let memorySessions: SimnetProofSession[] | null = null;

export function createLocalSimnetProofSessionStore(): SimnetProofSessionStore {
  return {
    async upsert(session) {
      const sessions = loadSessions();
      const existing = sessions.find((item) => item.proofSessionId === session.proofSessionId);
      const nextSession = existing ? { ...session, createdAt: existing.createdAt, updatedAt: session.updatedAt } : session;
      persistSessions([nextSession, ...sessions.filter((item) => item.proofSessionId !== session.proofSessionId)]);
      return nextSession;
    },

    async findById(proofSessionId) {
      return loadSessions().find((session) => session.proofSessionId === proofSessionId) ?? null;
    },

    async listByLookupCode(lookupCode, limit = 10) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadSessions()
        .filter((session) => normalizeLookupCode(session.lookupCode) === normalized)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },

    async listRecent(limit = 10) {
      return loadSessions()
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },
  };
}

export const simnetProofSessionStore = createLocalSimnetProofSessionStore();

function loadSessions(): SimnetProofSession[] {
  if (memorySessions) return memorySessions;
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    memorySessions = [];
    persistSessions(memorySessions);
    return memorySessions;
  }
  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as StoreFile;
  memorySessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  return memorySessions;
}

function persistSessions(sessions: SimnetProofSession[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  memorySessions = sessions;
  fs.writeFileSync(storePath, JSON.stringify({ sessions }, null, 2));
}

function normalizeLookupCode(lookupCode: string): string {
  return lookupCode.trim().toUpperCase();
}
