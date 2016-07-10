var TTTGame = {};

var WRONGPLAYERSERROR = "ERROR: You're not one of the players of this game";
var GAMEISRUNNING = "ERROR: A game is currently running";

/* game state is expressed as 10-bit ternary string, but stored as a decimal value
left-most bit is the turn bit
0 == Player1's turn
1 == Player2's turn

the next 9 bits are as follows:
1 | 2 | 3
--+---+---
4 | 5 | 6
--+---+---
7 | 8 | 9

0 == EMPTY CELL
1 == CELL WITH 0
2 == CELL WITH X

Player1 is O
Player2 is X
Player1 goes first
*/

/*
playersObj schema:
	teamID    : string,
	channelID : string,
	player1   : string,
	player2   : string
*/

TTTGame.no_op = function() {}

TTTGame.getPlayersObj = function(req) {
	var body = req.body;
	return {
		teamID    : body.team_id,
		channelID : body.channel_id,
		player1   : body.user_name,
		player2   : body.text
	};
}

// receives a ternary string
TTTGame.ternaryToDecimal = function(ternary) {
	var result = 0;
	var str = String(ternary);
	for (var i = str.length - 1; i >= 0; --i) {
		result += str[i] * Math.pow(3, str.length - 1 - i);
	}
	return result;
}

// returns a ternary string
TTTGame.decimalToTernary = function(decimal) {
	var result = "";
	if (decimal == 0) return "0";
	while (decimal > 0) {
		result = decimal % 3 + result;
		decimal = Math.floor(decimal / 3);
	}
	return result;
}

// receives a ternary string
TTTGame.gameWon = function(gameState) {
	var one   = gameState[1];
	    two   = gameState[2];
	    three = gateState[3];
	    four  = gameState[4];
	    five  = gameState[5];
	    six   = gameState[6];
	    seven = gameState[7];
	    eight = gameState[8];
	    nine  = gameState[9];
	return (( one   == two   && one   == three ) ||
		    ( four  == five  && four  == six   ) ||
		    ( seven == eight && seven == nine  ) ||
		    ( one   == four  && one   == seven ) ||
		    ( two   == five  && two   == eight ) ||
		    ( three == six   && three == nine  ) ||
		    ( one   == five  && one   == nine  ) ||
		    ( three == five  && three == seven ));
}

TTTGame.makeChannelQuery = function(playersObj) {
	return "SELECT * \n"          + 
		   "FROM TTTRECORDS \n"   + 
		   "WHERE CHANNELID = " + "'" + playersObj.channelID + "' \n" +
		   "AND   TEAMID    = " + "'" + playersObj.teamID + "';";
}

TTTGame.makeUpdateQuery = function(gameState, winner, gameRunning, playersObj) {
	return "UPDATE TTTRECORDS \n"   +
	       "SET   GAMESTATE   = " + gameState + ",\n" + 
	       "      WINNER      = " + "'" + winner + "',\n" +
	       "      GAMERUNNING = " + "'" + gameRunning + "' \n" +
	       "WHERE CHANNELID   = " + "'" + playersObj.channelID + "' \n" + 
	       "AND   TEAMID      = " + "'" + playersObj.teamID + "';";
}

TTTGame.makeInsertQuery = function(playersObj) {
	return "INSERT INTO TTTRECORDS (TEAMID,     \n" +
	       "                        CHANNELID,  \n" +
	       "                        PLAYER1,    \n" +
	       "                        PLAYER2,    \n" +
	       "                        GAMESTATE,  \n" +
	       "                        WINNER,     \n" +
	       "                        GAMERUNNING)\n" +
	       "VALUES ('" + playersObj.teamID    + "',\n" +
	       "        '" + playersObj.channelID + "',\n" +
	       "        '" + playersObj.player1   + "',\n" +
	       "        '" + playersObj.player2   + "',\n" +
	       "        "  + 0                    + ",\n" +
	       "        "  + "''"                 + ",\n" +
	       "        '" + "YES');"                 

}

// emulate Promise pattern
TTTGame.matchPlayers = function(db, playersObj, resolve, reject) {
	var self = this;
	resolve = resolve || self.no_op;
	reject = reject || self.no_op;

	db.query(self.makeChannelQuery(playersObj)).on('row', function(row) {
		if ((row.player1 == playersObj.player1) || (row.player2 == playersObj.player1)) {
			resolve();
		} else {
			reject();
		};
	});
}

// callbacks have a result parameter
TTTGame.createNewGame = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;


	var query = db.query(self.makeChannelQuery(playersObj));
	
	query.on('row', function(row) {
		if (row) {

			// this channel has previously played a game
			if (row.gamerunning === "YES") {

				// a game is currently running
				qresult.message = GAMEISRUNNING;
				callback(qresult);
			
			} else {

				db.query(self.makeUpdateQuery(0, "", "YES", playersObj))
					.on('end', function(result) {
						callback(qresult);
					});
			
			}
		}
	});
	
	query.on('end', function(result) {
		if (result.rowCount == 0) {

			// this channel has never played a game
			db.query(self.makeInsertQuery(playersObj))
				.on('end', function(result) {
					callback(qresult);
				});
		
		}
	});

}

TTTGame.restartGame = function(db, playersObj, callback) {
	var self = this;
	var result = {message: "success"};

	try {
		if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;
		db.query(self.makeUpdateQuery(0, "", "YES", playersObj));
	} catch (errmsg) {
		result.message = errmsg;
	}

	if (typeof callback === "function") callback(result);
}

TTTGame.quitGame = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	self.matchPlayers(db, playersObj, function() {

		db.query(self.makeUpdateQuery(0, "", "NO", playersObj))
			.on('end', function(result) {
				callback(qresult);
			});

	}, function() {

		qresult.message = WRONGPLAYERSERROR;
		callback(qresult);
	
	});

}

// move is the cell number
TTTGame.playerMove = function(db, playersObj, move, callback) {
	var self = this;
	var result = {message: "success"};

	try {
		if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;
		db.query(self.makeChannelQuery(playersObj)).on('row', function(row) {
			var prevState = self.decimalToTernary(row.gamestate);
			if (prevState[move] == 0) {
				prevState[move] = prevState[0] === "0" ? "1" : "2";

				// switch turns
				prevState[0] = prevState[0] === "0" ? "1" : "0";

				if (self.gameWon(prevState)) {
					// game won, game no longer running, winner produced
					db.query(
						self.makeUpdateQuery(
							self.ternaryToDecimal(prevState), 
							(prevState[0] === "0" ? playersObj.player1 : playersObj.player2), 
							"NO", 
							playersObj
						)
					);
					
					result.gameWon = true;

				} else {

					db.query(
						self.makeUpdateQuery(
							self.ternaryToDecimal(prevState), "", "YES", playersObj
						)
					);

					result.gameWon = false;

				}

			} else {
				// the cell was already filled
				throw "ERROR: invalid move";
			}

		});
	} catch (errmsg) {
		result.message = errmsg;
	}

	if (typeof callback === "function") callback(result);

}

module.exports = TTTGame;