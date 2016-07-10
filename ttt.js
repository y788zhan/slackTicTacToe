var TTTGame = {};

/* game state is expressed as 10-bit ternary string
left-most bit is the turn bit, the next 9 bits are as follows:
1 | 2 | 3
--+---+---
4 | 5 | 6
--+---+---
7 | 8 | 9

0 == EMPTY CELL
1 == CELL WITH 0
2 == CELL WITH X
*/

TTTGame.createNewGame(db, playersObj) {
	db.query("SELECT * FROM TTTRECORDS WHERE ")
}

module.exports = TTTGame;