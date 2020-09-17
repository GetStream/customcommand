const express = require("express");
const bodyParser = require("body-parser");

// setup StreamChat client for webhook verification
const stream = require("stream-chat");
const client = new stream.StreamChat(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET,
);
client.setBaseURL(process.env.STREAM_API_URL);

// Create our Express.js app
const app = express();

// Configure body parser to use JSON, but keep the `raw body`
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        // We need the raw body to verify the webhook later
        req.rawBody = buf;
    }
}));

// Middleware to verify webhook signature
app.use((req, res, next) => {
    if (!client.verifyWebhook(req.rawBody, req.headers['x-signature'])) {
        res.sendStatus(401); // Unauthorized
        return;
    }
    next()
});

const ticketHandler = require('./ticket');

app.post("/ticket", ticketHandler);

const hostname = "localhost";
const port = 3100;

app.listen(port, hostname, async () => {
    console.log(`Custom Command Handler listening at http://${hostname}:${port}`)
});