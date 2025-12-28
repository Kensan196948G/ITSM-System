// Knex.js Configuration for ITSM-Sec Nexus
// Database migration and schema management

require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || './backend/itsm_nexus.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './backend/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './backend/seeds'
    },
    pool: {
      afterCreate: (conn, cb) => {
        // Enable WAL mode for better concurrency
        conn.run('PRAGMA journal_mode = WAL;', (err) => {
          if (err) return cb(err);
          // Enable foreign keys
          conn.run('PRAGMA foreign_keys = ON;', cb);
        });
      }
    }
  },

  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || '/app/backend/itsm_nexus.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './backend/migrations',
      tableName: 'knex_migrations'
    },
    pool: {
      min: 1,
      max: 5,
      afterCreate: (conn, cb) => {
        // Enable WAL mode for better write concurrency
        conn.run('PRAGMA journal_mode = WAL;', (err) => {
          if (err) return cb(err);
          // Enable foreign keys
          conn.run('PRAGMA foreign_keys = ON;', (err2) => {
            if (err2) return cb(err2);
            // Optimize for production
            conn.run('PRAGMA synchronous = NORMAL;', (err3) => {
              if (err3) return cb(err3);
              conn.run('PRAGMA cache_size = -64000;', cb); // 64MB cache
            });
          });
        });
      }
    }
  }
};
