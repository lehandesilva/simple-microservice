const express = require("express");
const bodyParser = require("body-parser");

const app = express();

const typeRoutes = require("./routes/types");

app.use(bodyParser.urlencoded({ extended: false }));

app.use(typeRoutes);

app.listen(4000);
