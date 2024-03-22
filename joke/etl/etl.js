const express = require("express");
const app = express();
const db = require("./util/database-functions");
const amqp = require("amqplib");

const APP_CONSUMER_PORT = 3001;
const RMQ_CONSUMER_PORT = 4101;
const QUEUE_NAME = process.env.QUEUE_NAME;
const RMQ_USER_NAME = "admin";
const RMQ_PASSWORD = "admin";
const RMQ_HOST = "10.0.0.7";

app.get("/", (req, res) => {
  res.send(`ETL is up`);
});

const server = app.listen(APP_CONSUMER_PORT, () =>
  console.log(`Listening on port ${APP_CONSUMER_PORT}`)
);

app.get("/createTable", async (req, res) => {
  try {
    await db.createTable();
  } catch (error) {}
});

async function getMessages(channel, queue) {
  try {
    await channel.assertQueue(queue, { durable: true }); // Connect to durable queue or create if not there
    // Create callback that will listen for queued message availability
    channel.consume(queue, async (message) => {
      let msg = JSON.parse(message.content.toString()); // Convert message to string then json -> msg
      console.log(msg);
      await db.insertJoke(msg.joke, msg.punchline, msg.type);
      channel.ack(message); // Ack message so it will be removed from the queue
      console.log("Joke removed from queue db", msg);
    });
  } catch (err) {
    throw err;
  }
}

// Create connection and channel and return them to the caller
async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr); // Create connection
    console.log(`Connected to Rabbitmq cluster`);

    const channel = await connection.createChannel(); // Create channel. Channel can have multiple queues
    console.log(`Channel created. Will connect to queue: ${QUEUE_NAME}`);

    return { connection, channel };
  } catch (err) {
    console.log(`Failed to connect to RabbitMQ`);
    throw err;
  }
}

// This is a very simple consumer for the tv queue. Run it once and it will consume any messages in the queue
// You need to acknowledge receipt for it to be deleted
// Demo shows how you can look for specific queue and even specific messages - other apps may be looking for others
(async () => {
  // const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_CONSUMER_PORT}/`
  // Alternatively, create connection with an object to provide settings other than default

  const conStr = {
    hostname: RMQ_HOST,
    port: RMQ_CONSUMER_PORT,
    username: RMQ_USER_NAME,
    password: RMQ_PASSWORD,
    vhost: "/",
    reconnect: true, // Enable automatic reconnection
    reconnectBackoffStrategy: "linear", // or 'exponential'
  };

  try {
    const rmq = await createConnection(conStr); // amqplib is promise based so need to initialise it in a function as await only works in an async function
    console.log(`Connection created using: ${conStr}`);
    connection = rmq.connection; // Available if needed for something
    channel = rmq.channel;
    console.log(`Channel opened on Consumer1`);
    getMessages(channel, QUEUE_NAME); // Call to start the consumer callback
  } catch (err) {
    console.log(`General error: ${err}`);
    throw err;
  }
})().catch((err) => {
  console.log(
    `Shutting down node server listening on port ${APP_CONSUMER_PORT}`
  );
  server.close(); // Close the http server created with app.listen
  console.log(`Closing app with process.exit(1)`);
  process.exit(1); // Exit process with an error to force the container to stop
});
