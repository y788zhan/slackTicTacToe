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
function validateRequest(db, req, res, resolve, reject) {
    resolve = resolve || TTTController.no_op;
    reject = reject || TTTController.no_op;

    // tokens are stored directly in db
    // TODO (salted) hash tokens
    var query = db.query("SELECT * FROM SLACKTOKENS WHERE COMMAND = '" + req.body.command + "';");
    query.on('row', function(row) {
        if (row.token === req.body.token) {
            resolve(req, res);
        } else {
            reject(res);
        }
    });

    query.on('end', function(result) {
        if (result.rowCount === 0) reject(res);
    });
}

function isAuthenticated(req, res, next) {

  var query = db.query("SELECT * FROM SLACKTOKENS WHERE COMMAND = '" + req.body.command + "';");
  query.on('row', function(row) {

    if (row.token === req.body.token) {
      return next();
    } else {
      errHandler(res);
    }
  });

  query.on('end', function(result) {
    if (result.rowCount === 0) {
      errHandler(res);
    }
  });

}

app.use('/', isAuthenticated);

// responds with instructions of how to use custom slash commands
app.post('/usage', function(req, res) {

    //validateRequest(db, req, res, function(req, res) {

        res.status(200).json({
            "text": "/tttchallenge <user_name> : Challenges <user_name> to a tic-tac-toe game\n" +
                    "/tttaccept                : accepts the tic-tac-toe challenge\n" +
                    "/tttreject                : rejects the tic-tac-toe challenge\n" +
                    "/tttquit                  : Quits current game\n" +
                    "/tttboard                 : Displays the currently board of the game\n" +
                    "/tttmove <[1-9]>          : Makes your move on a cell"
        });

    //}, errHandler);

});

// challenges a user to a game
app.post('/challenge', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.createChallenge(db, po, function(result) {

            if (result.message === "success") {
                delayedRes.response_type = "in_channel";
                delayedRes.text = req.body.user_name + " has challenged " + req.body.text + " to a game of tic-tac-toe";
            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});

// accepts a challenge
app.post('/start', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.acceptChallenge(db, po, function(result) {
            if (result.message === "success") {

                delayedRes = JSON.parse(
                    JSON.stringify(
                        TTTBoard.makeBoard("0000000000", result.player1, result.player2)
                    )
                ); // deep copy
                delayedRes.response_type = "in_channel";
                delayedRes.text = req.body.user_name + " has accepted the challenged";

            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});

// rejects a challenge
app.post('/reject', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.rejectChallenge(db, po, function(result) {
            if (result.message === "success") {
                delayedRes.response_type = "in_channel";
                delayedRes.text = req.body.user_name + " has declined the challenge";
            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});

// quits a game
app.post('/quit', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.quitGame(db, po, function(result) {

            if (result.message === "success") {
                delayedRes.response_type = "in_channel";
                delayedRes.text = "Game quit";
            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});

// performs a move on one of the cells
app.post('/move', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.playerMove(db, po, req.body.text, function(result) {
            if (result.message === "success") {

                delayedRes = JSON.parse(
                    JSON.stringify(
                        TTTBoard.makeBoard(result.gameState, result.player1, result.player2)
                    )
                ); // deep copy

                if (result.gameWon) {

                    delayedRes.text = result.winner + " HAS WON";
                    delayedRes.attachments[0].text = "Game ended";

                }

            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});

app.post('/gamestate', function(req, res) {

    validateRequest(db, req, res, function(req, res) {

        quickResponseSlack(res);

        var po = TTTController.getPlayersObj(req);
        var delayedRes = {};

        TTTController.getGame(db, po, function(result) {

            if (result.message === "success") {

                delayedRes = JSON.parse(
                    JSON.stringify(
                        TTTBoard.makeBoard(result.gameState, result.player1, result.player2)
                    )
                ); // deep copy

                delayedRes.response_type = "ephemeral"; // do not display to everyone

            } else {
                delayedRes.text = result.message + "\nType /tttusage for help";
            }

            postBackSlack(req, delayedRes);
        });

    }, errHandler);

});


app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});