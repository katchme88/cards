// Setup basic express server
"use strict";
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var rules = require('./gameplay/rules.js');
let cache = require('./cache');

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

let deckJargons = {
    14: "Ace",
    13: "King",
    12: "Queen",
    11: "Jack",
    C: "Clubs",
    D: "Diamonds",
    S: "Spades",
    H: "Hearts"
}

function deal(deck) {
    var this_hand = [];
    for (var i = 0; i <= 12; i++) {
        var randomCard = deck.splice(0, 1);
        this_hand.push(randomCard[0]);
    }
    return this_hand;
}

io.on('connection', function(socket) {
    var addedUser = false;
    let thisCache;
    let roomID;
    let reConnected = false;
    // when the client emits 'add user', this listens and executes
    socket.on('add user', function(username) {

        if (addedUser) return;

        roomID = cache.addUser(socket, username);
        socket.roomID = roomID;
        socket.join(roomID);
        thisCache = cache.getGameCache(roomID);

        if (!(username in thisCache.usersCards)) {
            socket.username = username;
            ++thisCache.numUsers;
            ++thisCache.totalUsers;
            addedUser = true;
            var hand = deal(thisCache.deck);
            thisCache.usersCards[socket.username] = hand;
            if (thisCache.numUsers <= 4) {
                thisCache.players['p' + thisCache.numUsers] = {
                    username: socket.username,
                    socket: socket
                }
                thisCache.playerSequence.push(username);
            }
        } else {
            socket.username = username;
            for (let player in thisCache.players) {
                if (thisCache.players[player].username == username) {
                    thisCache.players[player].socket = socket
                }
            }
            var hand = thisCache.usersCards[username];
            ++thisCache.numUsers;
            reConnected = true;
            addedUser = true;
			clearTimeout(thisCache.dcTimeOut)
        }

        socket.emit('login', {
            numUsers: thisCache.numUsers,
            playerNumber: thisCache.playerSequence.indexOf(socket.username) + 1,
            playerSequence: thisCache.playerSequence,
        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.to(roomID).emit('user joined', {
            username: socket.username,
            numUsers: thisCache.numUsers,
            playerSequence: thisCache.playerSequence,
            reConnected: reConnected
        });

        if (reConnected) {
            if (thisCache.playerSequence[0] != socket.username) {
                if (thisCache.trumpRevealed == 0) {
                    socket.emit('trump setted', {
                        data: 'budRangi'
                    });
                } else if (thisCache.playerSequence[0] != socket.username && thisCache.trumpRevealed == 1) {
                    socket.emit('trump setted', {
                        data: 'budRangi'
                    });
                    socket.emit('reveal trump', {
                        username: thisCache.playerSequence[0],
                        trumpCard: thisCache.trumpCard
                    });
                }
            } else {
                if (thisCache.trumpRevealed == 0) {
                    socket.emit('trump card', {
                        data: thisCache.trumpCard
                    });
                }
            }

            for (const [key, value] of Object.entries(thisCache.currentRoundObj)) {
                socket.emit('card thrown', {
                    username: value,
                    message: key,
                    turn: thisCache.turn
                });
            }

            if (thisCache.turn < 4 && thisCache.turn > 0) {
                if (thisCache.playerSequence[thisCache.playerSequence.indexOf(Object.values(thisCache.currentRoundObj).pop()) + 1] == socket.username) {
                    socket.emit('your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit
                    });
                }
            }

            if (thisCache.turn == 0) {
                if (thisCache.lastRoundSenior == socket.username || thisCache.lastRoundSenior == '') {
                    socket.emit('your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit
                    });
                }
			}
			
			socket.emit('deal', {
				hand: thisCache.usersCards[socket.username]
			});

			if (thisCache.numUsers < 4) {
				socket.emit('disable ui', {
					message: 'Waiting for other players to join'
				});
			} else {
				io.to(roomID).emit('enable ui', {
					message: "Let's go!"
				});
			}
		}
		
		if (!reConnected) {
			socket.emit('deal', {
				hand: hand.slice(0, 5)
			});

			if (thisCache.numUsers < 4) {
				socket.emit('disable ui', {
					message: 'Waiting for other players to join'
				});
			} else {
				io.to(roomID).emit('enable ui', {
					message: "Let's go!"
				});
				thisCache.players.p1.socket.emit('choose bet', {
					highestBet: thisCache.highestBet
				});
			}
		}
			
    });

    socket.on('bet', function(data) {
        if (data.bet > thisCache.highestBet) {
            thisCache.highestBet = data.bet
            thisCache.highestBettor = socket.username
        }

        io.to(roomID).emit('bet', data)

        if (thisCache.playerSequence.indexOf(socket.username) < thisCache.playerSequence.length - 1) {
            var nextPlayerSocket = thisCache.players['p' + (thisCache.playerSequence.indexOf(socket.username) + 2)].socket
            nextPlayerSocket.emit('choose bet', {
                highestBet: thisCache.highestBet
            })
        } else {
            var n = thisCache.playerSequence.indexOf(thisCache.highestBettor)
            for (var i = 0; i < n; i++) {
                var p1 = thisCache.players.p2;
                var p2 = thisCache.players.p3;
                var p3 = thisCache.players.p4;
                var p4 = thisCache.players.p1;
                thisCache.players = {}
                thisCache.players['p1'] = p1;
                thisCache.players['p2'] = p2;
                thisCache.players['p3'] = p3;
                thisCache.players['p4'] = p4;
                thisCache.playerSequence.push(thisCache.playerSequence.shift());
            }
            console.log('highest bettor', thisCache.players.p1.username)

            for (var player in thisCache.players) {
                var soc = thisCache.players[player].socket;
                soc.emit('new sequence', {
                    playerSequence: thisCache.playerSequence,
                    playerNumber: thisCache.playerSequence.indexOf(thisCache.players[player].username) + 1
                });
            }

            thisCache.players.p1.socket.emit('choose trump', {
				chooseTrump: true,
				hand: '' 
            })

            thisCache.players.p2.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p2.username].slice(5, 13)
            })
            thisCache.players.p3.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p3.username].slice(5, 13)
            })
            thisCache.players.p4.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p4.username].slice(5, 13)
            })
        }
    });

    socket.on('trump card', function(data) {
        socket.broadcast.to(roomID).emit('trump setted', {
            data: 'budRangi'
        });
        socket.emit('trump card', {
            data: data
        });
        socket.emit('deal', {
            hand: thisCache.usersCards[socket.username].slice(5, 14)
        });
        socket.emit('your turn', {
            currentRoundSuit: ''
        });
        thisCache.trumpCard = data;
        thisCache.usersCards[socket.username].splice(thisCache.usersCards[socket.username].indexOf(data), 1)
    });

    socket.on('card thrown', function(data) {
        // we tell the client to execute 'card thrown'

        thisCache.turn++;

        socket.broadcast.to(roomID).emit('card thrown', {
            username: socket.username,
            message: data,
            turn: thisCache.turn
        });

        thisCache.usersCards[socket.username].splice(thisCache.usersCards[socket.username].indexOf(data), 1);

        if (thisCache.turn == 1) {
            thisCache.currentRoundSuit = data.split(/(\d+)/)[0];
        }

        if (thisCache.turn <= 4) {

            thisCache.currentRoundObj[data] = socket.username;
            thisCache.currentRoundCards.push(data);
            var nextPlayerSocket = thisCache.playerSequence.indexOf(socket.username) == 3 ? thisCache.players.p1.socket : thisCache.players['p' + (thisCache.playerSequence.indexOf(socket.username) + 2)].socket;
            if (thisCache.turn == 4) {

                thisCache.totalRounds++;
                var seniorArr = rules.getSenior(thisCache.currentRoundCards, thisCache.trumpRevealed, thisCache.trumpCard.charAt(0), thisCache.revealedInThis);
                var seniorCard = seniorArr[0];
                var seniorIndex = seniorArr[1];
                var seniorPlayer = Object.values(thisCache.currentRoundObj[seniorCard]);
                thisCache.lastRoundSenior = seniorPlayer;
                thisCache.currentRoundSuit = '';

                if (thisCache.trumpRevealed) {

                    if (thisCache.revealedInThis) {
                        thisCache.roundsSinceLastWin = thisCache.totalRounds;
                    } else {
                        thisCache.roundsSinceLastWin++;
                    }

                    var winnerFlag = rules.getWinner(seniorIndex, thisCache.roundsSinceLastWin, thisCache.revealedInThis, thisCache.totalRounds);

                }
            }
        }

        if (thisCache.turn == 4 && !winnerFlag) {
            io.to(roomID).emit('senior player', {
                username: thisCache.currentRoundObj[seniorCard],
                totalRounds: thisCache.totalRounds
            });
            nextPlayerSocket = thisCache.players['p' + (thisCache.playerSequence.indexOf(thisCache.currentRoundObj[seniorCard]) + 1)].socket;
            thisCache.currentRoundObj = {};
            thisCache.currentRoundCards = [];
            thisCache.turn = 0;
            thisCache.revealedInThis = 0;
        } else if (thisCache.turn == 4 && winnerFlag) {
            var roundWinner = thisCache.currentRoundObj[seniorCard];
            if (thisCache.players.p1.username == roundWinner || thisCache.players.p3.username == roundWinner) {
                thisCache.teamAHands += thisCache.roundsSinceLastWin;
            } else {
                thisCache.teamBHands += thisCache.roundsSinceLastWin;
            }
            io.to(roomID).emit('hands picked', {
                username: roundWinner,
                handsPicked: thisCache.roundsSinceLastWin,
                totalRounds: thisCache.totalRounds,
                teamAHands: thisCache.teamAHands,
                teamBHands: thisCache.teamBHands
            });
            nextPlayerSocket = thisCache.players['p' + (thisCache.playerSequence.indexOf(thisCache.currentRoundObj[seniorCard]) + 1)].socket;
            var x = {
                handsPicked: thisCache.roundsSinceLastWin,
                totalRounds: thisCache.totalRounds,
                teamAHands: thisCache.teamAHands,
                teamBHands: thisCache.teamBHands
            };
            thisCache.roundsSinceLastWin = 0;
            thisCache.turn = 0;
            thisCache.revealedInThis = 0;
            thisCache.currentRoundObj = {};
            thisCache.currentRoundCards = [];

            if (thisCache.teamAHands >= thisCache.highestBet || thisCache.teamBHands > (13 - thisCache.highestBet)) {
                var team = thisCache.teamAHands >= thisCache.highestBet ? 'teamA' : 'teamB';
                io.to(roomID).emit('winner announcement', {
                    winner: team
                });

                setTimeout(function() {
                    if (thisCache.teamAHands >= thisCache.highestBet) {
                        redeal();
                    } else {
                        next();
                    }
                }, 5000);

            }
        }

        if (thisCache.turn === 0) {
            setTimeout(function() {
                nextPlayerSocket.emit('your turn', {
                    currentRoundSuit: thisCache.currentRoundSuit
                });
            }, 3000)
        } else {
            nextPlayerSocket.emit('your turn', {
                currentRoundSuit: thisCache.currentRoundSuit
            });
        }
    });

    socket.on('request trump', function() {
        console.log(socket.username + ' asked for trump');
        io.sockets.to(roomID).emit('request trump', {
            username: socket.username,
        });
    });

    socket.on('reveal trump', function() {
        console.log('revealed trump');
        thisCache.revealedInThis = thisCache.turn;
        thisCache.trumpRevealed = 1;
        thisCache.usersCards[thisCache.playerSequence[0]].push(thisCache.trumpCard)
        var arr = thisCache.trumpCard.split(/(\d+)/);
        if (arr[1] > 10) {
            arr[1] = deckJargons[arr[1]];
        }
        io.to(roomID).emit('reveal trump', {
            username: socket.username,
            trumpCard: thisCache.trumpCard
        });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function() {
        let message = ''
        const TIMEOUT = 60000

        if (addedUser) {
			--thisCache.numUsers;
			   
            message = `${socket.username} disconnected. Waiting for user to re-join in ${TIMEOUT/1000} seconds`

            // echo globally that this client has left
            io.to(roomID).emit('user left', {
                username: socket.username,
                numUsers: thisCache.numUsers,
                message: message,
                timeout: TIMEOUT
            });

            io.to(roomID).emit('disable ui', {
                message: 'Player disconnected'
			});
			
            thisCache.dcTimeOut = setTimeout(function() {
                reset(roomID);
			}, TIMEOUT)			
		
			if (thisCache.trumpCard === '' ) {
            	reset(roomID);
            	return
        	} 
        }

        addedUser = false

    });

    socket.on('command', function(data) {
        if (data.command === 'next') {
            next(roomID);
        }

        if (data.command === 'redeal') {
            redeal(roomID);
        }

        if (data.command === 'reset') {
            reset(roomID);
        }

        if (data.command === 'team') {
            changeTeam(roomID);
        }

        if (data.command === 'showcache') {
            console.log(thisCache)
        }

    });

    function changeTeam(roomID) {
        if (thisCache.numUsers < 4) return;
        var p1 = thisCache.players.p1;
        var p2 = thisCache.players.p3;
        var p3 = thisCache.players.p2;
        var p4 = thisCache.players.p4;

        var a = thisCache.playerSequence[1];
        var b = thisCache.playerSequence[2];
        thisCache.playerSequence[1] = b;
        thisCache.playerSequence[2] = a;

        thisCache.players = {}
        thisCache.players['p1'] = p1;
        thisCache.players['p2'] = p2;
        thisCache.players['p3'] = p3;
        thisCache.players['p4'] = p4;
        thisCache.lastRoundSenior = '';
        redeal(roomID);
    }

    function next(roomID) {
        if (thisCache.numUsers < 4) return;
        var p1 = thisCache.players.p2;
        var p2 = thisCache.players.p3;
        var p3 = thisCache.players.p4;
        var p4 = thisCache.players.p1;
        thisCache.players = {}
        thisCache.players['p1'] = p1;
        thisCache.players['p2'] = p2;
        thisCache.players['p3'] = p3;
        thisCache.players['p4'] = p4;
        thisCache.playerSequence.push(thisCache.playerSequence.shift());
        thisCache.lastRoundSenior = '';
        thisCache.highestBet = 7;
        thisCache.highestBettor = '';
        redeal(roomID);
    }

    function reset(roomID) {
        io.to(roomID).emit('reset');
        thisCache.usersCards = {};
        thisCache.turn = 0;
        thisCache.totalRounds = 0;
        thisCache.teamA = [];
        thisCache.teamB = [];
        thisCache.teamAHands = 0;
        thisCache.teamBHands = 0;
        thisCache.trumpRevealed = 0;
        thisCache.revealedInThis = 0;
        thisCache.trumpCard = '';
        thisCache.currentRoundCards = [];
        thisCache.currentRoundObj = {};
        thisCache.currentRoundSuit;
        thisCache.roundsSinceLastWin = 0;
        thisCache.playerSequence = [];
        thisCache.players = {};
        thisCache.deck = require('./gameplay/deck.js').cards();
        thisCache.numUsers = 0;
        thisCache.totalUsers = 0;
        thisCache.lastRoundSenior = '';
        cache.deleteRoom(roomID);
    }

    function redeal(roomID) {
        if (thisCache.numUsers < 4) return;
        thisCache.usersCards = {};
        thisCache.turn = 0;
        thisCache.totalRounds = 0;
        thisCache.teamA = [];
        thisCache.teamB = [];
        thisCache.teamAHands = 0;
        thisCache.teamBHands = 0;
        thisCache.trumpRevealed = 0;
        thisCache.revealedInThis = 0;
        thisCache.trumpCard = '';
        thisCache.currentRoundCards = [];
        thisCache.currentRoundObj = {};
        thisCache.currentRoundSuit;
        thisCache.roundsSinceLastWin = 0;
        thisCache.deck = require('./gameplay/deck.js').cards();
        thisCache.lastRoundSenior = '';
        thisCache.highestBet = 7;
        thisCache.highestBettor = '';

        for (var player in thisCache.players) {
            var hand = deal(thisCache.deck);
            var soc = thisCache.players[player].socket;
            thisCache.usersCards[thisCache.players[player].username] = hand;

            soc.emit('redeal', {
                playerSequence: thisCache.playerSequence,
                playerNumber: thisCache.playerSequence.indexOf(thisCache.players[player].username) + 1
            });

            soc.emit('deal', {
                hand: hand.slice(0, 5),
                redeal: true
            });
        }
        thisCache.players.p1.socket.emit('choose bet', {
            highestBet: thisCache.highestBet
        });
    }

    socket.on('message', function(data) {
        socket.broadcast.emit('message', {
            username: data.username,
            message: data.message
        })
    })

});