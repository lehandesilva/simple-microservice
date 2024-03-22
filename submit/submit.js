const express = require("express");
const app = express();
const amqp = require("amqplib");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const APP_PRODUCER_PORT = 3200;
const RMQ_PRODUCER_PORT = 5672;
const RMQ_USER_NAME = "admin";
const RMQ_PASSWORD = "admin";
const RMQ_HOST = "rabbitmq";
const JOKES_SERVICE_HOST = "10.0.0.9";
const JOKES_SERVICE_PORT = "4000";

let gConnection; // File scope so functions can use them
let gChannel;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Swagger definition
const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: "Joke Service API",
      description: "API documentation for Joke Service",
      contact: {
        name: "Your Name",
      },
      servers: ["http://20.254.69.110/submit"],
    },
  },
  apis: ["./submit.js"], // Path to your routes file
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

// Serve Swagger UI documentation
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});
/**
 * @swagger
 * /submit/sub:
 *   post:
 *     description: Submit a joke to Joke Service
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               joke:
 *                 type: string
 *               punchline:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       '202':
 *         description: Joke submitted successfully
 *       '500':
 *         description: Internal server error
 */
app.post("/sub", async (req, res) => {
  try {
    const { joke, punchline, type } = req.body;
    await queueJoke(gChannel, joke, punchline, type);
    console.log("Joke queued", joke, punchline, type);
    res.sendStatus(202);
  } catch (err) {
    res.status(500).send(err);
  }
});
/**
 * @swagger
 * /submit/types:
 *   get:
 *     description: Get types data from Joke Service
 *     responses:
 *       '200':
 *         description: A successful response
 *       '500':
 *         description: Internal server error
 */
app.get("/types", async (req, res) => {
  try {
    const response = await fetch(
      `http://${JOKES_SERVICE_HOST}:${JOKES_SERVICE_PORT}/type`
    );
    const data = await response.json();
    const filePath = path.join(__dirname, "data", "typesData.json");
    fs.writeFileSync(filePath, JSON.stringify(data));
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching types:", error);
    const filePath = path.join(__dirname, "data", "typesData.json");
    const response = fs.readFileSync(filePath, "utf8");
    const typesData = JSON.parse(response);
    res.json(typesData);
  }
});

// app.listen returns an http server. Use this if we need to access the server - e.g. stop it
const server = app.listen(
  APP_PRODUCER_PORT,
  console.log(`Listening on port ${APP_PRODUCER_PORT}`)
);

/********************** Functions *************************************/
async function queueJoke(channel, joke, punchline, type) {
  const queue = "SUBMITTED_JOKES";

  try {
    await channel.assertQueue(queue, { durable: true });
    await channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ joke, punchline, type })),
      {
        persistent: true,
      }
    );
  } catch (error) {
    console.log("Faied to write joke to queue");
  }
}
async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr); // Create connection
    console.log(`Connected to rabbitmq using ${conStr}`);

    const channel = await connection.createChannel(); // Create channel. Channel can have multiple queues
    console.log(`Channel created`);

    return { connection, channel };
  } catch (err) {
    console.log(`Failed to connect to queue in createConection function`);
    throw err;
  }
}

// If needed, this is a function to close the queue connections
async function closeConnection(connection, channel) {
  try {
    await channel.close();
    await connection.close();
    console.log(`Connection and channel closed`);
  } catch (err) {
    console.log(`Failed to close connection. ${err}`);
  }
}

(async () => {
  const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_PRODUCER_PORT}/`;
  try {
    console.log(
      `Trying to connect to RabbitMQ at ${RMQ_HOST}:${RMQ_PRODUCER_PORT}`
    ); // Only give this level of detail away in testing
    const rmq = await createConnection(conStr); // amqplib is promise based so need to initialise it in a function as await only works in an async function
    gConnection = rmq.connection; // Globally available in the file for other functions to use if needed
    gChannel = rmq.channel;
  } catch (err) {
    console.log(err.message);
    if (gConnection) {
      closeConnection(gConnection, gChannel);
      console.log(`Closing connections`);
    }
    throw err; // kill the app
  }
})().catch((err) => {
  console.log(
    `Shutting down node server listening on port ${APP_PRODUCER_PORT}`
  );
  server.close(); // Close the http server created with app.listen
}); // () means call it now
