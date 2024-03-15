const mysql = require("mysql2/promise");

const HOST = process.env.MYSQL_CONTAINER_SERVICE || "mysql";
const USER = process.env.MYSQL_CONTAINER_USER || "admin";
const PASSWORD = process.env.MYSQL_CONTAINER_PASSWORD || "admin";
const DATABASE = process.env.MYSQL_CONTAINER_DATABASE || "jokes";
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;

let conStr = {
  host: HOST,
  user: USER,
  password: PASSWORD,
  database: DATABASE,
};

console.log(`Connecting with: `);
console.log(conStr);

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
  } catch (err) {
    console.error("Error creating table");
  }
}

async function insertJoke(joke, punchline, type) {
  try {
    const db = await mysql.createConnection(conStr);
    console.log("connected");
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
    console.log("Jokes retrieved successfully:", joke);
  } catch (err) {
    console.error("Error inserting joke", err);
  }
}

async function getRandJoke(type = null) {
  let typeQuery = "";
  let typeParams = [];

  try {
    if (type) {
      typeQuery = "WHERE t.type = ?";
      typeParams = [type];
    }

    // Get a random type if type is not provided
    if (!type) {
      const [randomType] = await db.query(
        "SELECT type FROM types ORDER BY RAND() LIMIT 1"
      );
      if (randomType.length > 0) {
        typeQuery = "WHERE t.type = ?";
        typeParams = [randomType[0].type];
      }
    }

    // Get a random joke of the specified type or random type
    const [joke] = await db.query(
      `
      SELECT j.joke, j.punchline
      FROM jokes j
      INNER JOIN types t ON j.type_id = t.id
      ${typeQuery}
      ORDER BY RAND()
      LIMIT 1
      `,
      typeParams
    );

    console.log("Random joke retrieved successfully:", joke);

    return joke.length > 0 ? joke[0] : null;
  } catch (error) {
    console.error("Error retrieving random joke");
  }
}

async function getJokes(type, count) {
  const [typeData] = await db.query("SELECT id FROM types WHERE type = ?", [
    type,
  ]);

  if (typeData.length === 0) {
    throw new Error("Type not found in database");
  }

  const typeId = typeData[0].id;

  try {
    // Get jokes of the specified type with the specified count
    const [jokes] = await db.query(
      "SELECT joke, punchline FROM jokes WHERE type_id = ? ORDER BY RAND() LIMIT ?",
      [typeId, count]
    );

    console.log("Jokes retrieved successfully:", jokes);

    return jokes;
  } catch (err) {
    console.error("Error retrieving jokes");
  }
}

async function getTypes() {
  try {
    const [types] = await connection.query("SELECT type FROM types");

    console.log("All types retrieved successfully:", types);

    return types;
  } catch (err) {
    console.error("Error returnig types");
  }
}

module.exports = {
  createTable,
  getRandJoke,
  getJokes,
  getTypes,
  insertJoke,
};
