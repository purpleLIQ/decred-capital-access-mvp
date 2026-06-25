import fs from "fs";
import path from "path";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";

export interface HeadlessLifecycleEventStore {
  save(event: HeadlessLifecycleEvent): Promise<HeadlessLifecycleEvent>;
  findByEventId?(eventId: string): Promise<HeadlessLifecycleEvent | null>;
  findByExternalReference?(lookupCode: string, externalReference: string): Promise<HeadlessLifecycleEvent | null>;
  findByWatcherEventId?(lookupCode: string, watcherEventId: string): Promise<HeadlessLifecycleEvent | null>;
  findByHealthResultId?(lookupCode: string, healthResultId: string): Promise<HeadlessLifecycleEvent | null>;
  findByArbiterDecisionId?(lookupCode: string, arbiterDecisionId: string): Promise<HeadlessLifecycleEvent | null>;
  listByLookupCode(lookupCode: string, limit?: number): Promise<HeadlessLifecycleEvent[]>;
  listRecent(limit?: number): Promise<HeadlessLifecycleEvent[]>;
}

type StoreFile = {
  events: HeadlessLifecycleEvent[];
};

const dataDir = path.join(process.cwd(), "data");
const eventStorePath = path.join(dataDir, "lifecycle-events.json");
let memoryEvents: HeadlessLifecycleEvent[] | null = null;

export function createLocalLifecycleEventStore(): HeadlessLifecycleEventStore {
  return {
    async save(event) {
      const events = loadEvents();
      const nextEvents = [event, ...events.filter((existing) => existing.id !== event.id)];
      persistEvents(nextEvents);
      return event;
    },

    async findByEventId(eventId) {
      return loadEvents().find((event) => event.id === eventId) ?? null;
    },

    async findByExternalReference(lookupCode, externalReference) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadEvents().find((event) => normalizeLookupCode(event.lookupCode) === normalized && event.externalReference === externalReference) ?? null;
    },

    async findByWatcherEventId(lookupCode, watcherEventId) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadEvents().find((event) => normalizeLookupCode(event.lookupCode) === normalized && event.payload.watcherEventId === watcherEventId) ?? null;
    },

    async findByHealthResultId(lookupCode, healthResultId) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadEvents().find((event) => normalizeLookupCode(event.lookupCode) === normalized && event.payload.healthResultId === healthResultId) ?? null;
    },

    async findByArbiterDecisionId(lookupCode, arbiterDecisionId) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadEvents().find((event) => normalizeLookupCode(event.lookupCode) === normalized && event.payload.arbiterDecisionId === arbiterDecisionId) ?? null;
    },

    async listByLookupCode(lookupCode, limit = 20) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadEvents()
        .filter((event) => normalizeLookupCode(event.lookupCode) === normalized)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async listRecent(limit = 25) {
      return loadEvents()
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
  };
}

export const lifecycleEventStore = createLocalLifecycleEventStore();

function loadEvents(): HeadlessLifecycleEvent[] {
  if (memoryEvents) return memoryEvents;
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(eventStorePath)) {
    memoryEvents = [];
    persistEvents(memoryEvents);
    return memoryEvents;
  }

  const parsed = JSON.parse(fs.readFileSync(eventStorePath, "utf8")) as StoreFile;
  memoryEvents = Array.isArray(parsed.events) ? parsed.events : [];
  return memoryEvents;
}

function persistEvents(events: HeadlessLifecycleEvent[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  memoryEvents = events;
  fs.writeFileSync(eventStorePath, JSON.stringify({ events }, null, 2));
}

function normalizeLookupCode(lookupCode: string): string {
  return lookupCode.trim().toUpperCase();
}
