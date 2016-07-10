var TTTGame = {};

var WRONGPLAYERSERROR = "ERROR: You're not one of the players of this game";

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
	       "AND   TEAMID      = " + "'" + playersObj.teamID + "';\n";
}

TTTGame.makeInsertQuery = function(playersObj) {
	return "INSERT INTO TTTRECORDS (TEAMID,     \n" +
	       "                        CHANNELID,  \n" +
	       "                        PLAYER1,    \n" +
	       "                        PLAYER2,    \n" +
	       "                        GAMESTATE,  \n" +
	       "                        WINNER,     \n" +
	       "                        GAMERUNNING)\n" +
	       "VALUES (" + playersObj.teamID    + ",\n" +
	       "        " + playersObj.channelID + ",\n" +
	       "        " + playersObj.player1   + ",\n" +
	       "        " + playersObj.player2   + ",\n" +
	       "        " + 0                    + ",\n" +
	       "        " + "''"                 + ",\n" +
	       "        " + "YES);"                 

}

TTTGame.matchPlayers = function(db, playersObj) {
	var self = this;

	db.query(self.makeChannelQuery(playersObj)).on('row', function(row) {
		return ((row.player1 === playersObj.player1) && (row.player2 === playersObj.player2));
	});
}

TTTGame.createNewGame = function(db, playersObj) {
	var self = this;

	db.query(self.makeChannelQuery(playersObj)).on('row', function(row) {
		if (row) {
			// this channel has previously played a game
			if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;

			if (row.gamerunning === "YES") {
				throw "ERROR: A game is currently running";
			} else {
				db.query(self.makeUpdateQuery(0, "", "YES", playersObj));
			}
		} else {
			// this channel has never played a game
			db.query(self.makeInsertQuery(playersObj));
		}
	});
}

TTTGame.restartGame = function(db, playersObj) {
	var self = this;

	if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;
	db.query(self.makeUpdateQuery(0, "", "YES", playersObj));
}

TTTGame.quitGame = function(db, playersObj) {
	var self = this;

	if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;
	db.query(self.makeUpdateQuery(0, "", "NO", playersObj));
}

// move is the cell number
TTTGame.playerMove = function(db, playersObj, move) {
	var self = this;

	if (!self.matchPlayers(db, playersObj)) throw WRONGPLAYERSERROR;
	db.query(self.makeChannelQuery(playersObj)).on('row', function(row) {
		var prevState = self.decimalToTernary(row.gamestate);
		if (prevState[move] == 0) {
			prevState[move] = prevState[0] === "0" ? "1" : "2";

			if (self.gameWon(prevState)) {
				// game won, game no longer running, winner produced, returns true
				db.query(
					self.makeUpdateQuery(
						self.ternaryToDecimal(prevState), 
						(prevState[0] === "0" ? playersObj.player1 : playersObj.player2), 
						"NO", 
						playersObj
					)
				);
				
				return true;

			} else {

				db.query(
					self.makeUpdateQuery(
						self.ternaryToDecimal(prevState), "", "YES", playersObj;
					)
				);

				return false;

			}
		} else {
			throw "ERROR: invalid move";
		}

	});

}

module.exports = TTTGame;