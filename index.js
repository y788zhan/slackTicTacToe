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
app.use(bodyParser.urlencoded({ extended: false }));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// postgres connection
var db;
pg.defaults.ssl = true;
pg.connect(process.env.DATABASE_URL, function(err, client) {
  if (err) throw err;
  console.log('Connected to postgres! Getting schemas...');

  db = client;

  client
    .query('SELECT table_schema,table_name FROM information_schema.tables;')
    .on('row', function(row) {
      //console.log(JSON.stringify(row));
    });
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

function ephemeralSlack(res) {
	res.status(200).json({
		"text": "Loading ..."
	});
}


app.post('/usage', function(req, res) {
	res.status(200).json({
	    "text": "\\ttt challenge <user_name> : Starts a tic-tac-toe game with <user_name>\n" +
	    		"\\ttt quit : Quits current game\n" +
	    		"\\ttt board : Displays the currently board of the game\n" +
	    		"\\ttt move [1-9] : Makes your move on a cell"
	});
});


app.post('/start', function(req, res) {
	// ephemeral
	ephemeralSlack(res);
	
	var po = TTTController.getPlayersObj(req);
	var delayedRes = {};

	TTTController.createNewGame(db, po, function(result) {

		if (result.message === "success") {
			delayedRes = TTTBoard.makeBoard("0000000000");
		} else {
			delayedRes.text = result.message;
		}

		postBackSlack(req, delayedRes);
	});

});


app.post('/quit', function(req, res) {
	ephemeralSlack(res);

	var po = TTTController.getPlayersObj(req);
	var delayedRes = {};

	TTTController.quitGame(db, po, function(result) {

		if (result.message === "success") {
			delayedRes.text = "Game quit";
		} else {
			delayedRes.text = result.message;
		}

		postBackSlack(req, delayedRes);
	});
});


app.post('/move', function(req, res) {
	ephemeralSlack(res);

	var po = TTTController.getPlayersObj(req);
	var delayedRes = {}

	TTTController.playerMove(db, po, req.body.text, function(result) {
		if (result.message === "success") {
			
			delayedRes = TTTBoard.makeBoard(result.gameState);
			if (result.gameWon) {
				delayedRes.text = result.winner + " HAS WON";
				delayedRes.attachments[0].text = "Game ended";
			}

		} else {
			delayedRes.text = result.message;
		}

		postBackSlack(req, delayedRes);

	});
});

app.post('/gamestate', function(req, res) {
	ephemeralSlack(res);

	var po = TTTController.getPlayersObj(req);
	var delayedRes = {};

	TTTController.getGame(db, po, function(result) {

		if (result.message === "success") {
			delayedRes = TTTBoard.makeBoard(result.gameState);
		} else {
			delayedRes.text = result.message;
		}

		postBackSlack(req, delayedRes);

	});

});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


