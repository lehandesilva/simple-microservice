const mysql = require("mysql2/promise");

const HOST = process.env.MYSQL_CONTAINER_SERVICE || "mysql";
const USER = process.env.MYSQL_CONTAINER_USER || "admin";
const PASSWORD = process.env.MYSQL_CONTAINER_PASSWORD || "admin";
const DATABASE = process.env.MYSQL_CONTAINER_DATABASE || "joke";
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;

let conStr = {
  host: HOST,
  user: USER,
  password: PASSWORD,
  database: DATABASE,
  port: MYSQL_PORT,
};

async function createTable() {
  try {
    const db = await mysql.createConnection(conStr);
    // SQL query to create 'types' table
    const createTypesTableQuery = `
      CREATE TABLE IF NOT EXISTS types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) UNIQUE NOT NULL
      );
    `;

    // SQL query to create 'jokes' table
    const createJokesTableQuery = `
      CREATE TABLE IF NOT EXISTS jokes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        joke VARCHAR(255) NOT NULL,
        punchline VARCHAR(255) NOT NULL,
        type_id INT,
        FOREIGN KEY (type_id) REFERENCES types(id)
      );
    `;

    await db.query(createTypesTableQuery);
    await db.query(createJokesTableQuery);
    await db.end();
  } catch (err) {
    console.error(`Error creating table`, { err });
  }
}

async function insertJoke(joke, punchline, type) {
  try {
    const db = await mysql.createConnection(conStr);
    const [existingTypes] = await db.query(
      "SELECT id FROM types WHERE type = ?",
      [type]
    );

    let typeId;
    if (existingTypes.length === 0) {
      // If type does not exist, insert it into the types table
      const [insertedType] = await db.query(
        "INSERT INTO types (type) VALUES (?)",
        [type]
      );
      typeId = insertedType.insertId;
    } else {
      typeId = existingTypes[0].id;
    }

    await db.query(
      "INSERT INTO jokes (joke, punchline, type_id) VALUES (?, ?, ?)",
      [joke, punchline, typeId]
    );
    await db.end();
  } catch (err) {
    console.error("Error inserting joke", err);
  }
}

module.exports = {
  createTable,
  insertJoke,
};
