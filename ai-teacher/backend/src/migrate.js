const fs = require('fs');
const path = require('path');
const db = require('./db');

function migrate() {
  const sqlPath = path.join(__dirname, 'migrations', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  db.exec(sql);
  console.log('[migrate] Database schema is up to date.');
}

migrate();

module.exports = migrate;
