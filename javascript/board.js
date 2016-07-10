var TTTBoard = {};

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

TTTBoard.board = {
    "text": "Current board: ",
    "attachments": [
        {
            "text": "Make a move",
            "callback_id": "_",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "1",
                    "text": "__",
                    "type": "button",
                    "value": "1"
                },
                {
                    "name": "2",
                    "text": "__",
                    "type": "button",
                    "value": "2"
                },
                {
                    "name": "3",
                    "text": "__",
                    "type": "button",
                    "value": "3"
                }
            ]
        }, {
            "text": "",
            "callback_id": "_",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "4",
                    "text": "__",
                    "type": "button",
                    "value": "4"
                },
                {
                    "name": "5",
                    "text": "__",
                    "type": "button",
                    "value": "5"
                },
                {
                    "name": "6",
                    "text": "__",
                    "type": "button",
                    "value": "6"
                }
            ]
        }, {
            "text": "",
            "callback_id": "_",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "7",
                    "text": "__",
                    "type": "button",
                    "value": "7"
                },
                {
                    "name": "8",
                    "text": "__",
                    "type": "button",
                    "value": "8"
                },
                {
                    "name": "9",
                    "text": "__",
                    "type": "button",
                    "value": "9"
                }
            ]
        }
    ]
};


TTTBoard.cellMap = {
    "0": "__",
    "1": "O",
    "2": "X"
}

// game state is a ternary string
TTTBoard.makeBoard = function(gameState) {
    var self = this;

    var arr = gameState.split("").slice(1, 10);
    var attach1 = self.board.attachments[0];
    var attach2 = self.board.attachments[1];
    var attach3 = self.board.attachments[2];

    for (var i = 0; i < 3; i++) {
        attach1.actions[i].text = self.cellMap[arr[i]];
        attach2.actions[i].text = self.cellMap[arr[i + 3]];
        attach3.actions[i].text = self.cellMap[arr[i + 6]];
    }

}


module.exports = TTTBoard;

