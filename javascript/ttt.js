var TTTController = {};

var WRONGPLAYERSERROR = "ERROR: You're not one of the players of this game";
var GAMEISRUNNING     = "ERROR: A game is currently running";
var GAMENOTRUNNING    = "ERROR: There is no game running currently";
var NOCHALLENGE       = "ERROR: There is no open challenge currently";
var NOTCHALLENGED     = "ERROR: You are not the challenged player";

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


String.prototype.replaceAt=function(index, character) {
    return this.substr(0, index) + character + this.substr(index + 1, this.length);
}


TTTController.no_op = function() {}

TTTController.getPlayersObj = function(req) {
	var body = req.body;
	return {
		teamID    : body.team_id,
		channelID : body.channel_id,
		player1   : body.user_name,
		player2   : body.text
	};
}

// receives a ternary string
TTTController.ternaryToDecimal = function(ternary) {
	var result = 0;
	var str = String(ternary);
	if (ternary == "0000000000") return 0;

	// remove leadings zeros
	var i = 0;
	while (str[i] == "0") { ++i; }
	str = str.substr(i, str.length);

	for (var i = str.length - 1; i >= 0; --i) {
		result += str[i] * Math.pow(3, str.length - 1 - i);
	}

	return result;
}

// returns a ternary string
TTTController.decimalToTernary = function(decimal) {
	var result = "";
	if (decimal == 0) return "0000000000";

	while (decimal > 0) {
		result = decimal % 3 + result;
		decimal = Math.floor(decimal / 3);
	}

	var len = result.length;
	for (var i = len; i < 10; ++i) {
		// leftpad with 0
		result = "0" + result;
	}

	return result;
}

// receives a ternary string
TTTController.gameWon = function(gameState) {
	var one   = gameState[1];
	    two   = gameState[2];
	    three = gameState[3];
	    four  = gameState[4];
	    five  = gameState[5];
	    six   = gameState[6];
	    seven = gameState[7];
	    eight = gameState[8];
	    nine  = gameState[9];
	return (( one   == two   && one   == three && one   != 0 ) ||
		    ( four  == five  && four  == six   && four  != 0 ) ||
		    ( seven == eight && seven == nine  && seven != 0 ) ||
		    ( one   == four  && one   == seven && one   != 0 ) ||
		    ( two   == five  && two   == eight && two   != 0 ) ||
		    ( three == six   && three == nine  && three != 0 ) ||
		    ( one   == five  && one   == nine  && one   != 0 ) ||
		    ( three == five  && three == seven && three != 0 ));
}

TTTController.makeChannelQuery = function(playersObj) {
	return "SELECT * \n"          + 
		   "FROM TTTRECORDS \n"   + 
		   "WHERE CHANNELID = " + "'" + playersObj.channelID + "' \n" +
		   "AND   TEAMID    = " + "'" + playersObj.teamID + "';";
}

TTTController.makeUpdateQuery = function(gameState, winner, gameRunning, playersObj, updatePlayer2) {
	return "UPDATE TTTRECORDS \n"   +
	       "SET   GAMESTATE   = " +       gameState            + ", \n" + 
	       "      WINNER      = " + "'" + winner               + "',\n" +
	       "      GAMERUNNING = " + "'" + gameRunning          + "',\n" +
(updatePlayer2 ? "PLAYER2     = " + "'" + playersObj.player2   + "' \n" : "") +
	       "WHERE CHANNELID   = " + "'" + playersObj.channelID + "' \n" + 
	       "AND   TEAMID      = " + "'" + playersObj.teamID    + "';";
}

TTTController.makeInsertQuery = function(playersObj) {
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
	       "        "  + 0                    + ", \n" +
	       "        "  + "''"                 + ", \n" +
	       "        '" + "CHALLENGED');"                 

}

// emulate Promise pattern
TTTController.matchPlayers = function(db, playersObj, resolve, reject) {
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
TTTController.createChallenge = function(db, playersObj, callback) {
	console.log('create challenge');
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	if (playersObj.player2 == undefined || playersObj.player2 === "") {
		qresult.message = "ERROR: No user was challenged";
		callback(qresult);
		return;
	}

	var query = db.query(self.makeChannelQuery(playersObj));
	
	query.on('row', function(row) {
		if (row) {
			// this channel has previously played a game
			if (row.gamerunning === "YES") {
				// a game is currently running
				qresult.message = GAMEISRUNNING;
				callback(qresult);
			
			} else {
				console.log(self.makeUpdateQuery(0, "", "CHALLENGED", playersObj, true));
				db.query(self.makeUpdateQuery(0, "", "CHALLENGED", playersObj, true))
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

TTTController.acceptChallenge = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	var query = db.query(self.makeChannelQuery(playersObj));
	console.log('hi');
	query.on('row', function(row) {
		if (row) {
			if (row.gamerunning === "YES") {
			console.log('yes');
				qresult.message = GAMEISRUNNING;
				callback(qresult);
			
			} else if (row.gamerunning === "NO") {
			console.log('no');
				qresult.message = NOCHALLENGE;
				callback(qresult);
			
			} else {
				console.log(row.player2, playersObj.player1);
				if (row.player2 == playersObj.player1) {
					db.query(self.makeUpdateQuery(0, "", "YES", playersObj, false))
						.on('end', function(result) {
							callback(qresult);
						})
						.on('error', function(result) {
							console.log(result);
						});
				} else {
					qresult.message = NOTCHALLENGED;
					callback(qresult);
				}
				
			}
		}
	});

	query.on('end', function(result) {
		if (result.rowCount === 0) {
			qresult.message = NOCHALLENGE;
			callback(qresult);
		}
	});
}

TTTController.rejectChallenge = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	var query = db.query(self.makeChannelQuery(playersObj));

	query.on('row', function(row) {
		if (row) {
			if (row.gamerunning === "YES") {
				
				qresult.message = GAMEISRUNNING;
				callback(qresult);
			
			} else if (row.gamerunning === "NO") {
			
				qresult.message = NOCHALLENGE;
				callback(qresult);
			
			} else {
				
				if (row.player2 == playersObj.player1) {
					db.query(self.makeUpdateQuery(0, "", "NO", playersObj, false))
						.on('end', function(result) {
							callback(qresult);
						});
				} else {
					qresult.message = NOTCHALLENGED;
					callback(qresult);
				}
			
			}
		}
	});

	query.on('end', function(result) {
		if (result.rowCount === 0) {
			qresult.message = NOCHALLENGE;
			callback(qresult);
		}
	});
}

TTTController.quitGame = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	// check to see if game exists
	var query = db.query(self.makeChannelQuery(playersObj));
	query.on('row', function(row) {
		if (row.gamerunning == "NO" || row.gamerunning == "CHALLENGED") {
			// there is no game being played
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		
		} else {
		
			self.matchPlayers(db, playersObj, function() {

				db.query(self.makeUpdateQuery(0, "", "NO", playersObj, false))
					.on('end', function(result) {
						callback(qresult);
					});

			}, function() {

				qresult.message = WRONGPLAYERSERROR;
				callback(qresult);
			
			});
		
		}
	});

	query.on('end', function(result) {
		if (result.rowCount === 0) {
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		}
	});

}

TTTController.getGame = function(db, playersObj, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;

	var query = db.query(self.makeChannelQuery(playersObj));
	query.on('row', function(row) {
		if (row.gamerunning == "NO" || row.gamerunning == "CHALLENGED") {
			
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		
		} else {

			qresult.gameState = self.decimalToTernary(row.gamestate);
			callback(qresult);
		
		}
	});

	query.on('end', function(result) {
		if (result.rowCount === 0) {
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		}
	});

}

// move is the cell number
TTTController.playerMove = function(db, playersObj, move, callback) {
	var self = this;
	var qresult = {message: "success"};
	callback = callback || self.no_op;
	move = Number(move);

	var query = db.query(self.makeChannelQuery(playersObj));
	query.on('row', function(row) {
		if (row.gamerunning == "NO" || row.gamerunning == "CHALLENGED") {
			
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		
		} else {

			self.matchPlayers(db, playersObj, function() {

				var prevState = self.decimalToTernary(row.gamestate);
				var newState;

				if (prevState[move] == 0) {
					prevState = prevState.replaceAt(move, prevState[0] === "0" ? "1" : "2");

					if (self.gameWon(prevState)) {
						// game won, game no longer running, winner produced
						newState = self.ternaryToDecimal(prevState);

						db.query(
							self.makeUpdateQuery(
								newState, 
								(prevState[0] === "0" ? playersObj.player1 : playersObj.player2), // this is the modifiedPrevState
								"NO", 
								playersObj,
								false
							)
						);
						
						qresult.gameWon = true;
						qresult.gameState = prevState; // this is the modified prevState
						qresult.winner = prevState[0] === "0" ? playersObj.player1 : playersObj.player2;

					} else {
						// switch turns
						prevState = prevState.replaceAt(0, prevState[0] === "0" ? "1" : "0");
						newState = self.ternaryToDecimal(prevState);

						db.query(
							self.makeUpdateQuery(
								newState, "", "YES", playersObj, false
							)
						);

						qresult.gameWon = false;
						qresult.gameState = prevState; // this is the modified prevState

					}

					callback(qresult);

				} else {
					// the cell was already filled
					qresult.message = "ERROR: invalid move";
					callback(qresult);
				}

			}, function() {

				qresult.message = WRONGPLAYERSERROR;
				callback(qresult);
			
			});

		}
	});

	query.on('end', function(result) {
		if (result.rowCount === 0) {
			qresult.message = GAMENOTRUNNING;
			callback(qresult);
		}
	});

}

module.exports = TTTController;