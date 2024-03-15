// RabbitMQ demo. Does nothing fancy - uses defaults. Queue is not set to be durable after container restart
const express = require("express");
const app = express();
const amqp = require("amqplib"); // Documentation here: https://www.npmjs.com/package/amqp

const APP_PRODUCER_PORT = 3200; // Using a higher port than usual to avoid any clashes with 3000 serries
const RMQ_PRODUCER_PORT = 5672; // Used 5673 to avoid port clash if running more than one local Rabbit container. 5672 if in container
const RMQ_USER_NAME = "admin";
const RMQ_PASSWORD = "admin";
//const RMQ_HOST = '20.90.112.187' // If mq is running in cloud but attaching from local vscode
const RMQ_HOST = "rabbitmq"; // Docker DNS for mq if conecting from a container whether local or not
// const RMQ_HOST = "localhost"; // Connect to local container from vscode

let gConnection; // File scope so functions can use them
let gChannel;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile("submit.html", { root: __dirname });
});

app.post("/submitJoke", async (req, res) => {
  console.log(req.body);
  try {
    const { joke, punchline, type } = req.body;
    await queueJoke(gChannel, joke, punchline, type);
    res.sendStatus(202);
  } catch (err) {
    res.status(500).send(err);
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
    console.log("Queue created");
    await channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ joke, punchline, type })),
      {
        persistent: true,
      }
    );
    console.log(`Added ${joke} of ${type} to ${queue}`);
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
