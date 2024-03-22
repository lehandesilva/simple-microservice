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

async function getJoke(type, count) {
  let typeQuery = "";
  let typeParams = [];

  try {
    const db = await mysql.createConnection(conStr);
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
      LIMIT ${count}
      `,
      typeParams
    );
    console.log("Joke being sent", joke);
    await db.end();
    return joke.length > 0 ? joke : null;
  } catch (error) {
    console.error("Error retrieving random joke", error);
  }
}

async function getTypes() {
  try {
    const db = await mysql.createConnection(conStr);
    const [types] = await db.query("SELECT type FROM types");
    await db.end();
    return types;
  } catch (err) {
    console.error("Error returning types", err);
  }
}

module.exports = {
  getJoke,
  getTypes,
};
