const express = require("express");
const app = express();
const amqp = require("amqplib");
const fs = require("fs");
const path = require("path");

const APP_PORT = 3100;
const RMQ_PRODUCER_PORT = 5672;
const RMQ_CONSUMER_PORT = 4201;
const RMQ_USER_NAME = "admin";
const RMQ_PASSWORD = "admin";
const PROD_QUEUE = process.env.PROD_QUEUE;
const CON_QUEUE = process.env.CON_QUEUE;
const RMQ_CON_HOST = "10.0.0.5";
const RMQ_PROD_HOST = "rabbitmq";
const JOKES_SERVICE_HOST = "10.0.0.9";
const JOKES_SERVICE_PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let producerConnection;
let consumerConnection;
let producerChannel;
let consumerChannel;
let jokeArray = [];

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.post("/mod", async (req, res) => {
  try {
    const { joke, punchline, type } = req.body;
    await queueJoke(producerChannel, joke, punchline, type);
    console.log("Joke queued", joke, punchline, type);
    res.sendStatus(202);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/mod", (req, res) => {
  try {
    const response = jokeArray.shift();
    if (response !== undefined) {
      console.log("joke being moderated right now", response);
      res.status(200).json(response);
    } else {
      res.sendStatus(204);
    }
  } catch (error) {
    console.error("Error getting jokes", error);
  }
});

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

const server = app.listen(APP_PORT, () =>
  console.log(`Listening on port ${APP_PORT}`)
);

async function queueJoke(channel, joke, punchline, type) {
  try {
    await channel.assertQueue(PROD_QUEUE, { durable: true });
    await channel.sendToQueue(
      PROD_QUEUE,
      Buffer.from(JSON.stringify({ joke, punchline, type })),
      {
        persistent: true,
      }
    );
  } catch (error) {
    console.log("Faied to write joke to queue");
  }
}

async function getMessages(channel, queue) {
  try {
    await channel.assertQueue(queue, { durable: true }); // Connect to durable queue or create if not there
    // Create callback that will listen for queued message availability
    channel.consume(queue, async (message) => {
      let msg = JSON.parse(message.content.toString()); // Convert message to string then json -> msg
      console.log("Joke received", msg);
      jokeArray.push(msg);
      console.log("Joke array currently", jokeArray);
      channel.ack(message); // Ack message so it will be removed from the queue
    });
  } catch (err) {
    throw err;
  }
}

// Create connection and channel and return them to the caller
async function createConnection(conStr, connectionType) {
  try {
    const connection = await amqp.connect(conStr); // Create connection
    console.log(`${connectionType} - Connected to Rabbitmq cluster`);

    const channel = await connection.createChannel(); // Create channel. Channel can have multiple queues
    console.log(`Channel created`);

    return { connection, channel };
  } catch (err) {
    console.log(`Failed to connect to RabbitMQ`);
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
  const prodConnectionStr = {
    hostname: RMQ_PROD_HOST,
    port: RMQ_PRODUCER_PORT,
    username: RMQ_USER_NAME,
    password: RMQ_PASSWORD,
  };

  const conConnectionStr = {
    hostname: RMQ_CON_HOST,
    port: RMQ_CONSUMER_PORT,
    username: RMQ_USER_NAME,
    password: RMQ_PASSWORD,
    vhost: "/",
    reconnect: true, // Enable automatic reconnection
    reconnectBackoffStrategy: "linear", // or 'exponential'
  };

  try {
    const conRMQ = await createConnection(conConnectionStr); // amqplib is promise based so need to initialise it in a function as await only works in an async function
    console.log(`Connection created using: ${conConnectionStr.hostname}`);
    const prodRMQ = await createConnection(prodConnectionStr); // amqplib is promise based so need to initialise it in a function as await only works in an async function
    console.log(`Connection created using: ${prodConnectionStr.hostname}`);
    consumerConnection = conRMQ.connection; // Available if needed for something
    producerConnection = prodRMQ.connection; // Available if needed for something
    consumerChannel = conRMQ.channel;
    console.log(`Channel opened on Consumer`);
    producerChannel = prodRMQ.channel;
    console.log(`Channel opened on Producer`);
    getMessages(consumerChannel, CON_QUEUE); // Call to start the consumer callback
  } catch (err) {
    console.log(`General error: ${err}`);
    if (producerConnection || consumerConnection) {
      closeConnection(producerConnection, producerChannel);
      closeConnection(consumerConnection, consumerChannel);
      console.log(`Closing connections`);
    }
    throw err;
  }
})().catch((err) => {
  console.log(`Shutting down node server listening on port ${APP_PORT}`);
  server.close(); // Close the http server created with app.listen
  console.log(`Closing app with process.exit(1)`);
  process.exit(1); // Exit process with an error to force the container to stop
});
