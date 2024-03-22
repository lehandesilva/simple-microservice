const express = require("express");
const cors = require("cors");
const db = require("./util/database-functions");
const path = require("path");

const APP_PORT = process.env.APP_PORT || 3000;
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.get("/type", async (req, res) => {
  const response = await db.getTypes();
  res.status(200).json(response);
});

app.get("/joke", async (req, res) => {
  let type;
  let count;
  req.query.type ? (type = req.query.type) : (type = null);
  req.query.count ? (count = req.query.count) : (count = 1);

  const response = await db.getJoke(type, count);
  console.log("Joke sent", response);
  res.status(200).json(response);
});

app.listen(APP_PORT, () => {
  console.log(`Listening port ${APP_PORT}`);
});
