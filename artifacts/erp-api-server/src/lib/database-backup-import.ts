import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getTenantDatabaseAdminUrl, getTenantDatabasePool } from "./db";

export const MAX_TENANT_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;

export type TenantBackupImportSummary = {
  sourceDatabaseVersion: string | null;
  tableCount: number;
  recordCounts: Record<string, number>;
  archiveSha256: string;
};

export class TenantBackupImportError extends Error {
  constructor(
    message: string,
    readonly dataRetained = false,
  ) {
    super(message);
    this.name = "TenantBackupImportError";
  }
}

const ERP_PUBLIC_ENUM_TYPES = new Set([
  "attendance_status",
  "caisse_kind",
  "caisse_movement_reason",
  "caisse_movement_type",
  "caisse_session_status",
  "caisse_transfer_status",
  "contact_type",
  "coupon_type",
  "employee_status",
  "inventory_movement_type",
  "lang",
  "leave_status",
  "leave_type",
  "order_status",
  "purchase_status",
  "stock_transfer_status",
  "supplier_operation_type",
  "transaction_category",
  "transaction_type",
  "user_role",
]);

type TocEntry = {
  line: string;
  category: string;
  schema: string | null;
  name: string | null;
};

function parseTocEntry(line: string): TocEntry | null {
  const match = /^\s*\d+;\s+\d+\s+\d+\s+(.+)$/.exec(line);
  if (!match) return null;
  const tokens = match[1]!.trim().split(/\s+/);
  if (tokens[0] === "TABLE" && tokens[1] === "DATA") {
    return { line, category: "TABLE DATA", schema: tokens[2] ?? null, name: tokens[3] ?? null };
  }
  if (tokens[0] === "SEQUENCE" && tokens[1] === "SET") {
    return { line, category: "SEQUENCE SET", schema: tokens[2] ?? null, name: tokens[3] ?? null };
  }
  if (tokens[0] === "MATERIALIZED" && tokens[1] === "VIEW") {
    const hasData = tokens[2] === "DATA";
    return {
      line,
      category: hasData ? "MATERIALIZED VIEW DATA" : "MATERIALIZED VIEW",
      schema: tokens[hasData ? 3 : 2] ?? null,
      name: tokens[hasData ? 4 : 3] ?? null,
    };
  }
  if (tokens[0] === "SCHEMA" && tokens[1] === "-") {
    return { line, category: "SCHEMA", schema: tokens[2] ?? null, name: tokens[2] ?? null };
  }
  if (tokens[0] === "FK" && tokens[1] === "CONSTRAINT") {
    return { line, category: "FK CONSTRAINT", schema: tokens[2] ?? null, name: tokens[3] ?? null };
  }
  if (tokens[0] === "DEFAULT" && tokens[1] === "ACL") {
    return { line, category: "DEFAULT ACL", schema: tokens[3] ?? null, name: tokens[4] ?? null };
  }
  return {
    line,
    category: tokens[0] ?? "",
    schema: tokens[1] === "-" ? tokens[2] ?? null : tokens[1] ?? null,
    name: tokens[1] === "-" ? tokens[3] ?? null : tokens[2] ?? null,
  };
}

export function selectTenantArchiveEntries(toc: string): {
  list: string;
  sourceDatabaseVersion: string | null;
  tableNames: string[];
} {
  const lines = toc.split(/\r?\n/);
  const entries = lines.map(parseTocEntry).filter((entry): entry is TocEntry => entry !== null);
  const hasErpSchema = entries.some((entry) => entry.category === "SCHEMA" && entry.schema === "erp");
  if (!hasErpSchema) {
    throw new TenantBackupImportError(
      "This backup does not contain the ERP data schema. No tenant data was changed.",
    );
  }

  const tableNames = [...new Set(
    entries
      .filter((entry) => entry.category === "TABLE DATA" && entry.schema === "erp" && entry.name)
      .map((entry) => entry.name!),
  )].sort();
  if (!["users", "stores", "products", "orders"].every((name) => tableNames.includes(name))) {
    throw new TenantBackupImportError(
      "The backup is missing required ERP table data. No tenant data was changed.",
    );
  }

  const importableCategories = new Set([
    "AGGREGATE",
    "CAST",
    "CHECK",
    "COLLATION",
    "COMMENT",
    "CONSTRAINT",
    "CONVERSION",
    "DEFAULT",
    "DOMAIN",
    "FK CONSTRAINT",
    "FUNCTION",
    "INDEX",
    "MATERIALIZED VIEW",
    "MATERIALIZED VIEW DATA",
    "OPERATOR",
    "POLICY",
    "PROCEDURE",
    "RULE",
    "SCHEMA",
    "SEQUENCE",
    "SEQUENCE SET",
    "SHELL",
    "STATISTICS",
    "TABLE",
    "TABLE DATA",
    "TEXT",
    "TRIGGER",
    "TYPE",
    "VIEW",
  ]);

  const selected = entries.filter((entry) => {
    if (!importableCategories.has(entry.category)) return false;
    if (entry.schema === "erp") return true;
    return entry.category === "TYPE" &&
      entry.schema === "public" &&
      entry.name !== null &&
      ERP_PUBLIC_ENUM_TYPES.has(entry.name.replace(/^"|"$/g, ""));
  });

  const blobEntries = entries.filter((entry) =>
    entry.category === "BLOB" || entry.category === "BLOBS" || entry.category === "BLOB DATA");
  if (blobEntries.length > 0) {
    throw new TenantBackupImportError(
      "This backup contains PostgreSQL large objects that cannot be safely assigned to one tenant. No tenant data was changed.",
    );
  }

  if (!selected.some((entry) => entry.category === "TABLE DATA")) {
    throw new TenantBackupImportError("The backup contains no ERP table records.");
  }

  const version = lines
    .map((line) => /^;\s*Dumped from database version:\s*(.+)$/.exec(line)?.[1]?.trim() ?? null)
    .find((value) => value !== null) ?? null;

  return {
    list: selected.map((entry) => entry.line).join("\n") + "\n",
    sourceDatabaseVersion: version,
    tableNames,
  };
}

function runPgRestore(
  args: string[],
  env: NodeJS.ProcessEnv,
  captureStdout: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_restore", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (!captureStdout) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > 32 * 1024 * 1024) {
        child.kill("SIGKILL");
        fail(new TenantBackupImportError("The backup archive listing is too large to validate."));
        return;
      }
      stdout.push(chunk);
    });
    // Do not retain or log pg_restore diagnostics; they can include source SQL
    // and values copied from the customer's database.
    child.stderr.resume();
    child.on("error", (error) => {
      fail((error as NodeJS.ErrnoException).code === "ENOENT"
        ? new TenantBackupImportError("PostgreSQL restore tools are unavailable on this server.")
        : new TenantBackupImportError("Could not read the PostgreSQL backup archive."));
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        fail(new TenantBackupImportError(
          captureStdout
            ? "The file is not a readable PostgreSQL custom archive."
            : "PostgreSQL could not restore the ERP data. The new tenant database was left unchanged.",
        ));
        return;
      }
      settled = true;
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

function pgPassEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

async function createPgRestoreEnvironment(
  databaseName: string,
  directory: string,
): Promise<NodeJS.ProcessEnv> {
  const url = new URL(getTenantDatabaseAdminUrl(databaseName));
  let username: string;
  let password: string;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new TenantBackupImportError("The tenant database connection is invalid.");
  }
  const port = url.port || "5432";
  const passFile = path.join(directory, ".pgpass");
  await writeFile(
    passFile,
    `*:${pgPassEscape(port)}:${pgPassEscape(databaseName)}:${pgPassEscape(username)}:${pgPassEscape(password)}\n`,
    { mode: 0o600, flag: "wx" },
  );

  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: port,
    PGDATABASE: databaseName,
    PGUSER: username,
    PGPASSFILE: passFile,
    PGCONNECT_TIMEOUT: "30",
    PGSSLMODE: url.searchParams.get("sslmode") ?? process.env["PGSSLMODE"] ?? "prefer",
  };
}

async function countImportedRows(databaseName: string, tableNames: string[]): Promise<Record<string, number>> {
  const targetPool = getTenantDatabasePool(databaseName);
  const recordCounts: Record<string, number> = {};
  for (const tableName of tableNames) {
    if (!/^[a-zA-Z0-9_$-]+$/.test(tableName)) continue;
    const identifier = tableName.replaceAll('"', '""');
    const result = await targetPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "erp"."${identifier}"`,
    );
    recordCounts[tableName] = Number(result.rows[0]?.count ?? 0);
  }
  return recordCounts;
}

export async function importTenantDatabaseBackup(
  tenantId: number,
  databaseName: string,
  source: Readable,
): Promise<TenantBackupImportSummary> {
  if (!Number.isInteger(tenantId) || tenantId <= 0 ||
      databaseName !== `erp_tenant_${tenantId}`) {
    throw new TenantBackupImportError("Invalid tenant database target.");
  }

  const directory = await mkdtemp(path.join(tmpdir(), "midanic-erp-import-"));
  const archivePath = path.join(directory, "source.dump");
  const listPath = path.join(directory, "erp-objects.list");
  const hash = createHash("sha256");
  let bytesReceived = 0;

  try {
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesReceived += chunk.length;
        if (bytesReceived > MAX_TENANT_BACKUP_BYTES) {
          callback(new TenantBackupImportError("The backup exceeds the 2 GB upload limit."));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(source, limiter, createWriteStream(archivePath, { flags: "wx", mode: 0o600 }));
    if (bytesReceived === 0) throw new TenantBackupImportError("The uploaded backup file is empty.");

    const env = await createPgRestoreEnvironment(databaseName, directory);
    const toc = await runPgRestore(["--list", archivePath], env, true);
    const selection = selectTenantArchiveEntries(toc);
    await writeFile(listPath, selection.list, { mode: 0o600, flag: "wx" });

    const targetPool = getTenantDatabasePool(databaseName);
    const targetState = await targetPool.query<{ schema_exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'erp') AS schema_exists",
    );
    if (targetState.rows[0]?.schema_exists) {
      throw new TenantBackupImportError(
        "The tenant database already contains ERP data and must be checked before another upload.",
        true,
      );
    }

    await runPgRestore([
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      databaseName,
      "--use-list",
      listPath,
      archivePath,
    ], env, false);

    let recordCounts: Record<string, number>;
    try {
      recordCounts = await countImportedRows(databaseName, selection.tableNames);
    } catch {
      throw new TenantBackupImportError(
        "ERP data was restored, but its summary could not be checked. The tenant must be checked before another upload.",
        true,
      );
    }
    return {
      sourceDatabaseVersion: selection.sourceDatabaseVersion,
      tableCount: selection.tableNames.length,
      recordCounts,
      archiveSha256: hash.digest("hex"),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}