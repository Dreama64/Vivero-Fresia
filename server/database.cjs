'use strict';
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, hash) {
  const [salt, hex] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hex, 'hex'));
}
function openDatabase(directory) {
  fs.mkdirSync(path.join(directory, 'images'), { recursive:true });
  const db = new DatabaseSync(path.join(directory, 'vivero.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL, price INTEGER, available INTEGER NOT NULL,
      visible INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);`);
  if (!db.prepare("SELECT value FROM settings WHERE key='seeded'").get()) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../catalog.seed.json'), 'utf8'));
    db.exec('BEGIN IMMEDIATE');
    try {
      const insert = db.prepare('INSERT INTO products(id,name,category,description,image,price,available,visible) VALUES(?,?,?,?,?,?,?,?)');
      seed.forEach(p => insert.run(p.id,p.name,p.category,p.description,p.image,p.price,Number(p.available),Number(p.visible)));
      db.prepare("INSERT INTO settings VALUES('seeded','1')").run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}
module.exports = { openDatabase, passwordHash, verifyPassword };
