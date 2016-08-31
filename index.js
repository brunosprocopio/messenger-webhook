const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const net = require('net');

var NODE_SERVER_HOST = '127.0.0.1';
var NODE_SERVER_PORT = 6968;

var app = express();

// SET UP SERVER
app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// WEBHOOK EVENTS
// For Facebook verification
app.get('/webhook', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'VERIFY_TOKEN') {
        console.log("Validating webhook ...");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

// Spin up the server
app.listen(app.get('port'), function () {
    console.log('Running on port', app.get('port'))
});

app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function (pageEntry) {

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function (messagingEvent) {
                if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                }
                else {
                    console.log("Webhook received unknown messaging Event: ", messagingEvent);
                }
            });
        });

        // Assume all went well
        res.sendStatus(200);
    }
});

// SERVER EVENTS
net.createServer(function (sock) {
    sock.on('data', function () {
        console.log('Received message in net Server ...');
    });
}).listen(NODE_SERVER_PORT, NODE_SERVER_HOST);

// FUNCTIONS
function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {

        // If we receive a text message, check to see if it matches any special
        // keywords and send back the corresponding example. Otherwise, just echo
        // the text we received.
        switch (messageText) {
            case 'image':
            case 'button':
            case 'generic':
            case 'receipt':
                break;

            default:
                sendTextMessage(senderID, messageText);
        }
    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachment received");
    }
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: 'PAGE_ACCESS_TOKEN'},
        method: 'POST',
        json: messageData
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
        } else {
            console.error("Unable to send message.")
            console.error(response);
            console.error(error);
        }
    });
}