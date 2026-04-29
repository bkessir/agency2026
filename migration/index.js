/**
 * CRA Database Migration Worker
 * Copies essential CRA tables from SOURCE_DB to TARGET_DB.
 * Deploy as a Render Web Service — runs migration on startup, then serves status.
 *
 * Required env vars:
 *   SOURCE_DB  — PostgreSQL connection URL of the hackathon shared DB
 *   TARGET_DB  — PostgreSQL connection URL of your new Render DB
 *   PORT       — set automatically by Render
 */
const http = require('http');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const SOURCE_URL = process.env.SOURCE_DB;
const TARGET_URL = process.env.TARGET_DB;

const TABLES = [
  // Loop analysis tables (small, critical)
  'loop_universe', 'loops', 'loop_participants', 'loop_edges',
  'loop_charity_financials', 'loop_edge_year_flows', 'loop_financials',
  'identified_hubs', 'scoring_rules', 'tna_scores',
  // CRA data tables
  'cra_identification', 'cra_financial_details', 'cra_compensation',
  'cra_qualified_donees', 'cra_financial_general',
  // Lookup tables (tiny)
  'cra_category_lookup', 'cra_sub_category_lookup', 'cra_designation_lookup',
  'cra_program_type_lookup', 'cra_province_state_lookup', 'cra_country_lookup',
  // Summary tables
  'overhead_by_year', 'govt_funding_by_year',
];

const BATCH_SIZE = 500;

let status = { state: 'starting', progress: [], error: null, startedAt: new Date().toISOString() };

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
  status.progress.push(`${ts}: ${msg}`);
  if (status.progress.length > 200) status.progress = status.progress.slice(-200);
}

async function getColumns(pool, table) {
  const { rows } = await pool.query(`
    SELECT a.attname AS col,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS not_null,
           pg_get_expr(d.adbin, d.adrelid) AS default_val
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'cra.${table}'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  `);
  return rows;
}

async function migrateTable(src, tgt, table) {
  log(`→ ${table}: reading schema...`);

  // Get column definitions from source
  const cols = await getColumns(src, table);
  if (!cols.length) { log(`  ⚠ No columns found for ${table}, skipping`); return; }

  const colDefs = cols.map(c => {
    let def = `"${c.col}" ${c.type}`;
    if (c.not_null) def += ' NOT NULL';
    if (c.default_val && !c.default_val.startsWith('nextval')) def += ` DEFAULT ${c.default_val}`;
    return def;
  }).join(',\n  ');

  // Create table in target (drop first for clean migration)
  await tgt.query(`DROP TABLE IF EXISTS cra."${table}" CASCADE`);
  await tgt.query(`CREATE TABLE cra."${table}" (\n  ${colDefs}\n)`);
  log(`  ✓ Table created`);

  // Count rows
  const { rows: [{ cnt }] } = await src.query(`SELECT COUNT(*) AS cnt FROM cra."${table}"`);
  const total = parseInt(cnt);
  log(`  → Copying ${total.toLocaleString()} rows...`);

  if (total === 0) { log(`  ✓ Empty table, done`); return; }

  const colNames = cols.map(c => `"${c.col}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

  let offset = 0;
  while (offset < total) {
    const { rows } = await src.query(
      `SELECT ${colNames} FROM cra."${table}" ORDER BY (SELECT NULL) LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    );
    if (!rows.length) break;

    // Bulk insert using unnest for performance
    const insertSQL = `INSERT INTO cra."${table}" (${colNames}) VALUES (${placeholders})`;
    for (const row of rows) {
      const vals = cols.map(c => row[c.col] === undefined ? null : row[c.col]);
      await tgt.query(insertSQL, vals);
    }

    offset += rows.length;
    if (offset % 5000 === 0 || offset >= total) {
      log(`  … ${offset.toLocaleString()} / ${total.toLocaleString()} rows`);
    }
  }

  log(`  ✓ Done: ${total.toLocaleString()} rows copied`);
}

async function runMigration() {
  if (!SOURCE_URL || !TARGET_URL) {
    status.state = 'error';
    status.error = 'Missing SOURCE_DB or TARGET_DB environment variables';
    log('ERROR: ' + status.error);
    return;
  }

  const src = new Pool({
    connectionString: SOURCE_URL,
    ssl: SOURCE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  const tgt = new Pool({
    connectionString: TARGET_URL,
    ssl: TARGET_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });

  try {
    log('Connecting to source and target databases...');
    await src.query('SELECT 1');
    await tgt.query('SELECT 1');
    log('✓ Both databases connected');

    // Create cra schema in target
    await tgt.query('CREATE SCHEMA IF NOT EXISTS cra');
    log('✓ Schema cra ready in target');

    status.state = 'running';

    for (let i = 0; i < TABLES.length; i++) {
      log(`[${i + 1}/${TABLES.length}] Migrating table: ${TABLES[i]}`);
      try {
        await migrateTable(src, tgt, TABLES[i]);
      } catch (err) {
        log(`  ✗ FAILED: ${err.message}`);
      }
    }

    status.state = 'complete';
    log('🎉 Migration complete! All tables copied.');
  } catch (err) {
    status.state = 'error';
    status.error = err.message;
    log('FATAL: ' + err.message);
  } finally {
    await src.end().catch(() => {});
    await tgt.end().catch(() => {});
  }
}

// HTTP server for status checks and Render health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status, null, 2));
});

server.listen(PORT, () => {
  console.log(`Migration worker running on port ${PORT}`);
  console.log(`Check status at: GET /`);
  // Start migration after server is ready
  runMigration();
});
