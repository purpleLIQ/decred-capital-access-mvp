import fs from "fs";
import path from "path";
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import { decredAdapter } from "./adapters/decred-adapter";
import { demoEvents, demoLoans } from "./fixtures";
import type { Loan, LoanEvent, LoanStatus } from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "demo.sqlite");
let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function getDb(): Promise<Database> {
  return openDb();
}

export async function listLoans(): Promise<Loan[]> {
  const db = await getDb();
  return rows<Loan>(db, "SELECT * FROM loans ORDER BY createdAt DESC");
}

export async function getLoan(id: string): Promise<Loan | null> {
  const db = await getDb();
  return rows<Loan>(db, "SELECT * FROM loans WHERE id = ?", [id])[0] ?? null;
}

export async function listEvents(loanId?: string): Promise<LoanEvent[]> {
  const db = await getDb();
  if (loanId) {
    return rows<LoanEvent>(db, "SELECT * FROM events WHERE loanId = ? ORDER BY createdAt DESC", [loanId]);
  }

  return rows<LoanEvent>(db, "SELECT * FROM events ORDER BY createdAt DESC LIMIT 25");
}

export async function createLoan(input: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
}): Promise<Loan> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = `loan_${crypto.randomUUID()}`;
  const ref = `DCR-${Math.floor(1000 + Math.random() * 9000)}`;
  const escrow = decredAdapter.createDemoEscrow(ref);
  const collateralUsd = Number((input.collateralDcr * 12.13).toFixed(2));
  const ltv = Math.round((input.borrowAmount / collateralUsd) * 10000);
  const loan: Loan = {
    id,
    ref,
    borrowerName: "New demo borrower",
    lenderName: "Demo treasury",
    status: "awaiting_collateral",
    collateralDcr: input.collateralDcr,
    collateralUsd,
    borrowAsset: input.borrowAsset,
    borrowAmount: input.borrowAmount,
    initialLtvBps: ltv,
    currentLtvBps: ltv,
    aprBps: 1450,
    termDays: 30,
    escrowAddress: escrow.address,
    redeemScript: escrow.redeemScript,
    borrowerPubkey: `02borrower-${ref}`,
    lenderPubkey: `02lender-${ref}`,
    arbiterPubkey: `02arbiter-${ref}`,
    depositTxid: null,
    payoutTxid: null,
    repaymentTxid: null,
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
    ticketProofStatus: "not_used",
  };

  insertLoan(db, loan);
  insertEvent(db, {
    id: `evt_${crypto.randomUUID()}`,
    loanId: loan.id,
    type: "loan_created",
    message: "Demo loan created with a 2-of-3 Decred escrow preview.",
    actor: "system",
    createdAt: now,
  });
  persist(db);

  return loan;
}

export async function updateLoan(loan: Loan, event: Omit<LoanEvent, "id">): Promise<{ loan: Loan; event: LoanEvent }> {
  const db = await getDb();
  const savedEvent = { ...event, id: `evt_${crypto.randomUUID()}` };
  run(
    db,
    `UPDATE loans SET
      status = ?, collateralUsd = ?, currentLtvBps = ?, depositTxid = ?, payoutTxid = ?,
      repaymentTxid = ?, updatedAt = ?
    WHERE id = ?`,
    [
      loan.status,
      loan.collateralUsd,
      loan.currentLtvBps,
      loan.depositTxid,
      loan.payoutTxid,
      loan.repaymentTxid,
      loan.updatedAt,
      loan.id,
    ],
  );
  insertEvent(db, savedEvent);
  persist(db);
  return { loan, event: savedEvent };
}

async function openDb(): Promise<Database> {
  fs.mkdirSync(dataDir, { recursive: true });
  const SQL = await getSql();
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  migrate(db);
  seed(db);
  persist(db);
  return db;
}

function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }

  return sqlPromise;
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      ref TEXT NOT NULL,
      borrowerName TEXT NOT NULL,
      lenderName TEXT NOT NULL,
      status TEXT NOT NULL,
      collateralDcr REAL NOT NULL,
      collateralUsd REAL NOT NULL,
      borrowAsset TEXT NOT NULL,
      borrowAmount REAL NOT NULL,
      initialLtvBps INTEGER NOT NULL,
      currentLtvBps INTEGER NOT NULL,
      aprBps INTEGER NOT NULL,
      termDays INTEGER NOT NULL,
      escrowAddress TEXT NOT NULL,
      redeemScript TEXT NOT NULL,
      borrowerPubkey TEXT NOT NULL,
      lenderPubkey TEXT NOT NULL,
      arbiterPubkey TEXT NOT NULL,
      depositTxid TEXT,
      payoutTxid TEXT,
      repaymentTxid TEXT,
      dueAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ticketProofStatus TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      loanId TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      actor TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
}

function seed(db: Database): void {
  const count = rows<{ count: number }>(db, "SELECT COUNT(*) as count FROM loans")[0]?.count ?? 0;
  if (count > 0) return;

  for (const loan of demoLoans) {
    insertLoan(db, loan);
  }
  for (const event of demoEvents) {
    insertEvent(db, event);
  }
}

function insertLoan(db: Database, loan: Loan): void {
  run(
    db,
    `INSERT INTO loans VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      loan.id,
      loan.ref,
      loan.borrowerName,
      loan.lenderName,
      loan.status,
      loan.collateralDcr,
      loan.collateralUsd,
      loan.borrowAsset,
      loan.borrowAmount,
      loan.initialLtvBps,
      loan.currentLtvBps,
      loan.aprBps,
      loan.termDays,
      loan.escrowAddress,
      loan.redeemScript,
      loan.borrowerPubkey,
      loan.lenderPubkey,
      loan.arbiterPubkey,
      loan.depositTxid,
      loan.payoutTxid,
      loan.repaymentTxid,
      loan.dueAt,
      loan.createdAt,
      loan.updatedAt,
      loan.ticketProofStatus,
    ],
  );
}

function insertEvent(db: Database, event: LoanEvent): void {
  run(db, "INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)", [
    event.id,
    event.loanId,
    event.type,
    event.message,
    event.actor,
    event.createdAt,
  ]);
}

function rows<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result: T[] = [];

  while (stmt.step()) {
    result.push(stmt.getAsObject() as T);
  }

  stmt.free();
  return result.map(normalizeRow) as T[];
}

function run(db: Database, sql: string, params: SqlValue[] = []): void {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function persist(db: Database): void {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function normalizeRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  if (typeof record.status === "string") record.status = record.status as LoanStatus;
  return record;
}
