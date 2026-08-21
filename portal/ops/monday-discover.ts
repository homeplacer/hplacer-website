/**
 * Monday.com discovery and link import — operator tooling.
 *
 *   node portal/ops/monday-discover.ts --board homes --db ./portal/.local/portal.sqlite
 *
 * Default mode is **discovery**: it reads a Monday board, works out which
 * portal record each item corresponds to, prints what it found, and writes a
 * JSON report. It changes nothing.
 *
 *   --import-links   also write the unambiguous matches into monday_links.
 *                    This is a PORTAL-side write only. Nothing is sent to
 *                    Monday, then or ever, by this command.
 *
 * Outbound writes to Monday are not implemented. `MondayClient` refuses any
 * document containing a mutation, and `--write-to-monday` exists only to say so
 * out loud. See portal/README.md → "Monday.com" for what adding one would take.
 *
 * The API token is read from the macOS Keychain at the moment of use (service
 * `homeplacer-monday-api`, account `homeplacer-portal`) and is never printed,
 * logged, or written to the report.
 *
 * Without network access — or before anyone is comfortable pointing this at a
 * live board — run it against a saved payload instead:
 *
 *   node portal/ops/monday-discover.ts --board homes --fixture ./board.json
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { SqliteDb } from "../src/platform/sqlite.ts";
import { newId, nowIso } from "../src/platform/ids.ts";
import { createMondayClient, fetchBoardItems, type MondayItem } from "../src/integrations/monday-client.ts";
import { keychainTokenSource } from "../src/integrations/monday-credentials.ts";
import { buildPortalIndex, planImport, summarizePlan, type ImportPlan } from "../src/integrations/monday-discovery.ts";
import { QueuedMondaySyncPort, linkEntity, type CanonicalKeyKind, type MondayBoardKey } from "../src/integrations/monday.ts";

interface Options {
  board: MondayBoardKey;
  dbPath: string;
  fixture: string | null;
  keyColumns: string[];
  outPath: string | null;
  limit: number;
  importLinks: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    board: "homes",
    dbPath: process.env.PORTAL_DB_PATH ?? "./portal/.local/portal.sqlite",
    fixture: null,
    keyColumns: [],
    outPath: null,
    limit: 5000,
    importLinks: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--board": options.board = next() as MondayBoardKey; break;
      case "--db": options.dbPath = next(); break;
      case "--fixture": options.fixture = next(); break;
      case "--key-column": options.keyColumns.push(next()); break;
      case "--out": options.outPath = next(); break;
      case "--limit": options.limit = Number(next()); break;
      case "--import-links": options.importLinks = true; break;
      case "--write-to-monday":
        console.error(
          "Refused. This tool never writes to Monday.\n" +
            "The client rejects mutations, and no call site enables them.\n" +
            "Adding an outbound write is a deliberate, reviewed change — see portal/README.md → Monday.com.",
        );
        process.exit(2);
        break;
      case "--help":
      case "-h":
        console.log(HELP);
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option ${arg}\n\n${HELP}`);
          process.exit(2);
        }
    }
  }
  return options;
}

const HELP = `Monday.com discovery (read-only by default)

  --board <homes|equipment|jobs|tasks|repairs>   which configured board to read
  --db <path>                                    portal SQLite file (or PORTAL_DB_PATH)
  --fixture <path>                               read a saved API payload instead of calling Monday
  --key-column <id|title>                        trust only this column for the canonical key (repeatable)
  --limit <n>                                    stop after n items (default 5000)
  --out <path>                                   write the JSON report here
  --import-links                                 write the unambiguous matches into monday_links (portal-side only)
  --write-to-monday                              refused; outbound writes are not implemented`;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = new SqliteDb(options.dbPath);

  const board = await db
    .prepare("SELECT board_key, monday_board_id, name, canonical_key_kind, active FROM monday_boards WHERE board_key = ?")
    .bind(options.board)
    .first<{ board_key: MondayBoardKey; monday_board_id: string; name: string; canonical_key_kind: CanonicalKeyKind; active: number }>();

  if (!board) {
    console.error(`The "${options.board}" board is not configured. Add it at /admin/monday in the portal first.`);
    process.exit(1);
  }

  let items: MondayItem[] = [];
  let columnTitles = new Map<string, string>();
  let sourceLabel: string;

  if (options.fixture) {
    const payload = JSON.parse(readFileSync(options.fixture, "utf8")) as {
      items?: MondayItem[];
      columns?: { id: string; title: string }[];
      data?: { boards?: { items_page?: { items?: MondayItem[] }; columns?: { id: string; title: string }[] }[] };
    };
    const fromGraphql = payload.data?.boards?.[0];
    items = payload.items ?? fromGraphql?.items_page?.items ?? [];
    for (const column of payload.columns ?? fromGraphql?.columns ?? []) columnTitles.set(column.id, column.title);
    sourceLabel = `fixture ${options.fixture}`;
  } else {
    const client = createMondayClient(keychainTokenSource());
    // describe() never includes the token — only where it came from.
    sourceLabel = client.describe();
    const fetched = await fetchBoardItems(client, board.monday_board_id, { maxItems: options.limit });
    items = fetched.items;
    columnTitles = new Map(
      (items[0]?.column_values ?? []).map((column) => [column.id, column.id]),
    );
  }

  const index = await buildPortalIndex(db, board.board_key, board.canonical_key_kind);
  const plan = planImport(items, index, {
    boardKey: board.board_key,
    mondayBoardId: board.monday_board_id,
    kind: board.canonical_key_kind,
    preferColumns: options.keyColumns,
    columnTitles,
  });

  console.log(`Source: ${sourceLabel}`);
  console.log(`Portal database: ${options.dbPath}`);
  console.log(summarizePlan(plan));
  console.log("");
  printTable(plan);

  let linksWritten = 0;
  if (options.importLinks) {
    const port = new QueuedMondaySyncPort(db);
    for (const item of plan.writable) {
      if (!item.entity_type || !item.entity_id) continue;
      try {
        await linkEntity(db, port, {
          entityType: item.entity_type,
          entityId: item.entity_id,
          boardKey: board.board_key,
          mondayItemId: item.monday_item_id,
        });
        linksWritten += 1;
      } catch (error) {
        console.error(`  ! ${item.entity_label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`\nWrote ${linksWritten} link${linksWritten === 1 ? "" : "s"} into monday_links. Nothing was sent to Monday.`);
  } else if (plan.matched > 0) {
    console.log(`\n${plan.matched} link${plan.matched === 1 ? " is" : "s are"} ready. Re-run with --import-links to write ${plan.matched === 1 ? "it" : "them"}.`);
  }

  await recordRun(db, plan, options.importLinks ? "import_links" : "discover", linksWritten);

  if (options.outPath) {
    writeFileSync(options.outPath, JSON.stringify(plan, null, 2));
    console.log(`Report written to ${options.outPath}`);
  }
  db.close();
}

function printTable(plan: ImportPlan): void {
  const order = { conflict: 0, ambiguous: 1, unmatched: 2, match: 3, already_linked: 4 };
  const rows = [...plan.items].sort((a, b) => order[a.outcome] - order[b.outcome]);
  for (const row of rows.slice(0, 200)) {
    const mark = row.outcome === "match" ? "+" : row.outcome === "already_linked" ? "=" : row.outcome === "unmatched" ? "-" : "!";
    console.log(`  ${mark} ${row.outcome.padEnd(14)} item ${row.monday_item_id.padEnd(12)} ${row.entity_label ?? row.item_name}`);
    if (row.outcome !== "match" && row.outcome !== "already_linked") console.log(`      ${row.detail}`);
  }
  if (rows.length > 200) console.log(`  … and ${rows.length - 200} more (use --out for the full report)`);
}

async function recordRun(db: SqliteDb, plan: ImportPlan, mode: "discover" | "import_links", linksWritten: number): Promise<void> {
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO monday_discovery_runs (id, board_key, mode, started_at, finished_at, items_seen, matched,
                                          ambiguous, unmatched, conflicts, links_written, report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId("mdr"),
      plan.board_key,
      mode,
      timestamp,
      timestamp,
      plan.items_seen,
      plan.matched,
      plan.ambiguous,
      plan.unmatched,
      plan.conflicts,
      linksWritten,
      // The report holds board ids, item ids, and portal ids. No credentials.
      JSON.stringify(plan),
    )
    .run();
}

await main();
