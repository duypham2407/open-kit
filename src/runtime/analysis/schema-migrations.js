/**
 * Database schema migration utility for the Multi-Layer Intelligence Stack.
 *
 * SchemaManager tracks applied schema versions in a `schema_version` table and
 * applies pending migrations sequentially within transactions. This is the
 * foundation that ProjectGraphDb (and later L2/L3/L4 tables) use to evolve
 * their schemas safely.
 */

export class SchemaManager {
  constructor(db) {
    this.db = db;
    this.initVersionTable();
  }

  initVersionTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at REAL NOT NULL
      )
    `);
  }

  getCurrentVersion() {
    const row = this.db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get();
    return row?.version || 0;
  }

  migrate(migrations) {
    const currentVersion = this.getCurrentVersion();

    const pendingMigrations = migrations
      .filter((m) => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare(
            'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)'
          )
          .run(migration.version, Date.now() / 1000);
      })();
    }
  }
}
