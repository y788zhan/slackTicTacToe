var express       = require('express');
var pg            = require('pg');
var bodyParser    = require('body-parser');
var request       = require('request');
var TTTController = require('./javascript/ttt');
var TTTBoard      = require('./javascript/board');
var app           = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

// postgres connection
var db;
pg.defaults.ssl = true;
pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (err) throw err;
    db = client;
});


// TIC TAC TOE API ENDPOINTS

function postBackSlack(req, body) {
    request({
        url: req.body.response_url,
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify(body)
    });
}

// respond with 3000ms to acknowledge request
function quickResponseSlack(res) {
    res.status(200).json({
        "text": "Loading ..."
    });
}

// respond with 500 error upon token mismatch
function errHandler(res) {
    res.status(500).json({
        "message": "ERROR: request not from Slack"
    });
}

// check if request originated from Slack
function isFromSlack(req, res, next) {

  var query = db.query("SELECT * FROM SLACKTOKENS WHERE TOKEN = '" + req.body.token + "';");

  query.on('end', function(result) {
    if (result.rowCount === 0) {
      errHandler(res);
    } else {
      return next();
    }
  });

}

app.use('/', isFromSlack);


app.post('/ttt', function(req, res) {
  
  var content = req.body.text.trim();
  var firstWord = content.substr(0, content.indexOf(" "));

  if (firstWord === "challenge") {
    res.redirect(307, '/challenge');
  } else if (firstWord === "move") {
    res.redirect(307, '/move');
  }

  switch(content) {
    case "usage" :
      res.redirect(307, '/usage');
      break;
    case "accept" :
      res.redirect(307, '/start');
      break;
    case "reject" :
      res.redirect(307, '/reject');
      break;
    case "board" :
      res.redirect(307, '/gamestate');
      break;
    case "quit" :
      res.redirect(307, '/quit');
      break;
    default:
      res.status(200).json({
        "text": "Invalid command. Type /ttt usage for help"
      });
  }
  
});

// responds with instructions of how to use custom slash commands
app.post('/usage', function(req, res) {

    quickResponseSlack(res);

    delayedRes = {
      "text": TTTController.instructions
    };

    postBackSlack(req, delayedRes);

});

// challenges a user to a game
app.post('/challenge', function(req, res) {

    quickResponseSlack(res);

    req.body.text = req.body.text.split(" ").splice(-1)[0]; // give the last word of text
    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.createChallenge(db, po, function(result) {

        if (result.message === "success") {
            delayedRes.response_type = "in_channel";
            delayedRes.text = req.body.user_name + " has challenged " + req.body.text + " to a game of tic-tac-toe";
        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});

// accepts a challenge
app.post('/start', function(req, res) {

    quickResponseSlack(res);

    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.acceptChallenge(db, po, function(result) {
        if (result.message === "success") {

            delayedRes = JSON.parse(JSON.stringify(TTTBoard.makeBoard(result))); // deep copy
            delayedRes.response_type = "in_channel";
            delayedRes.text = req.body.user_name + " has accepted the challenge";


            // test timeout
            setTimeout(function() {
              TTTController.forceQuit(db, po);
            }, 3000);

        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});

// rejects a challenge
app.post('/reject', function(req, res) {

    quickResponseSlack(res);

    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.rejectChallenge(db, po, function(result) {
        if (result.message === "success") {
            delayedRes.response_type = "in_channel";
            delayedRes.text = req.body.user_name + " has declined the challenge";
        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});

// quits a game
app.post('/quit', function(req, res) {

    quickResponseSlack(res);

    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.quitGame(db, po, function(result) {

        if (result.message === "success") {
            delayedRes.response_type = "in_channel";
            delayedRes.text = "Game quit";
        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});

// performs a move on one of the cells
app.post('/move', function(req, res) {

    quickResponseSlack(res);

    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.playerMove(db, po, req.body.text.split(" ").splice(-1)[0], function(result) {
        if (result.message === "success") {

            delayedRes = JSON.parse(JSON.stringify(TTTBoard.makeBoard(result))); // deep copy

        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});

app.post('/gamestate', function(req, res) {

    quickResponseSlack(res);

    var po = TTTController.getPlayersObj(req);
    var delayedRes = {};

    TTTController.getGame(db, po, function(result) {

        if (result.message === "success") {

            delayedRes = JSON.parse(JSON.stringify(TTTBoard.makeBoard(result))); // deep copy

            delayedRes.response_type = "ephemeral"; // do not display to everyone

        } else {
            delayedRes.text = result.message + "\nType /ttt usage for help";
        }

        postBackSlack(req, delayedRes);
    });

});


app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
