// Setup basic express server
"use strict";
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const redis = require("redis");
const rules = require('./gameplay/rules');
let cache = require('./cache');
const uid = require('uuid/v4');
const keys = require('./keys');

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

// Routing

app.use(express.static(path.join(__dirname, 'public')));
app.post(['/authenticate', '/api/authenticate'], require('./routes/authenticate'));

const deckJargons = {
    14: "Ace",
    13: "King",
    12: "Queen",
    11: "Jack",
    C: "Clubs",
    D: "Diamonds",
    S: "Spades",
    H: "Hearts"
}

const UP = 'upstream'
const DOWN = 'downstream'
const LOCAL = 'local'

const deal = (deck) => {
    var this_hand = [];
    for (var i = 0; i <= 12; i++) {
        var randomCard = deck.splice(0, 1);
        this_hand.push(randomCard[0]);
    }
    return this_hand;
}

const deepCopy = (sourceObject, destinationObject) => {

    for(let key in sourceObject) {
        if(typeof sourceObject[key] != "object") {
            destinationObject[key] = sourceObject[key];
        } else {
            destinationObject[key] = {};
            deepCopy(sourceObject[key], destinationObject[key]);
        }
    }
}

io.on('connection', function(socket) {
    var addedUser = false;
    let roomID;
    let thisCache;
    let reConnected = false;
    
    // when the client emits 'add user', this listens and executes
    socket.on('add user', function(data) {
        if (addedUser) return;
        const username = data.username
        const playerID = data.playerID
        roomID = cache.addUser(socket, username);
        socket.roomID = roomID;
        socket.join(roomID);
        thisCache = cache.getGameCache(roomID);
        log(DOWN, username ,'add user', data);
        if (!(username in thisCache.usersCards)) {
            socket.username = username;
            ++thisCache.numUsers;
            ++thisCache.totalUsers;
            addedUser = true;
            var hand = deal(thisCache.deck);
            thisCache.usersCards[socket.username] = hand;
            if (thisCache.numUsers <= 4) {
                thisCache.players['p' + thisCache.numUsers] = {
                    username: username,
                    socket: socket,
                    score: 0,   
                    wins: 0,
                    handsPicked: 0,
                    playerID: playerID
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

        log(UP, username, 'login', {
            numUsers: thisCache.numUsers,
            playerNumber: thisCache.playerSequence.indexOf(socket.username) + 1,
            playerSequence: thisCache.playerSequence
        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.to(roomID).emit('user joined', {
            username: socket.username,
            numUsers: thisCache.numUsers,
            playerSequence: thisCache.playerSequence,
            reConnected: reConnected
        });

        log(UP, 'broadcast', 'user joined', {
            username: socket.username,
            numUsers: thisCache.numUsers,
            playerSequence: thisCache.playerSequence,
            reConnected: reConnected
        });

        if (reConnected) {

            socket.emit('deal', {
                hand: thisCache.usersCards[socket.username],
                redeal: true
            });
            
            log(UP, username, 'deal', {
                hand: thisCache.usersCards[socket.username],
                redeal: true
            });

            if (thisCache.moodaCalled && thisCache.moodaAccepted) {
                socket.emit('mooda', {
                    username: thisCache.playerSequence[0],
                    moodaSuit: thisCache.moodaSuit,
                    reConnected: reConnected
                });

                log(UP, username, 'mooda', {
                    username: thisCache.playerSequence[0],
                    moodaSuit: thisCache.moodaSuit,
                    reConnected: reConnected
                });

            } else {
                if (thisCache.playerSequence[0] != socket.username) {

                    if (thisCache.trumpRevealed == 0) {
                        socket.emit('trump setted', {
                            data: 'budRangi'
                        });

                        log(UP, username, 'trump setted', {
                            data: 'budRangi'
                        });

                    } else if (thisCache.playerSequence[0] != socket.username && thisCache.trumpRevealed == 1) {
                        
                        socket.emit('trump setted', {
                            data: 'budRangi'
                        });

                        log(UP, username, 'trump setted', {
                            data: 'budRangi'
                        }); 

                        socket.emit('reveal trump', {
                            username: thisCache.playerSequence[0],
                            trumpCard: thisCache.trumpCard
                        });

                        log(UP, username, 'reveal trump', {
                            username: thisCache.playerSequence[0],
                            trumpCard: thisCache.trumpCard
                        });
                    }
                } else {
                    if (thisCache.trumpRevealed == 0) {

                        socket.emit('trump card', {
                            data: thisCache.trumpCard
                        });

                        log(UP, username, 'trump card', {
                            data: thisCache.trumpCard
                        });
                    }
                }
            }

            for (const [key, value] of Object.entries(thisCache.currentRoundObj)) {
                
                socket.emit('card thrown', {
                    username: value,
                    message: key,
                    turn: thisCache.turn
                });

                log(UP, username, 'card thrown', {
                    username: value,
                    message: key,
                    turn: thisCache.turn
                });
            }
            //xconsole.log(thisCache.turn);
            if (thisCache.turn < 4 && thisCache.turn > 0) {
                
                if (thisCache.playerSequence[thisCache.playerSequence.indexOf(Object.values(thisCache.currentRoundObj).pop()) + 1] == socket.username) {
                    socket.emit('your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit,
						totalRounds: thisCache.totalRounds,
						moodaCalled: thisCache.moodaCalled
                    });

                    log(UP, username, 'your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit,
						totalRounds: thisCache.totalRounds,
						moodaCalled: thisCache.moodaCalled
                    });
                }
            }

            if (thisCache.turn == 0) {
                if (thisCache.lastRoundSenior == socket.username || (thisCache.lastRoundSenior == '' && thisCache.totalRounds > 0)) {
                    
                    socket.emit('your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit,
						totalRounds: thisCache.totalRounds,
						moodaCalled: thisCache.moodaCalled
                    });
                    
                    log(UP, username, 'your turn', {
                        currentRoundSuit: thisCache.currentRoundSuit,
						totalRounds: thisCache.totalRounds,
						moodaCalled: thisCache.moodaCalled
                    });
                }
			}

			if (thisCache.numUsers < 4) {

				socket.emit('disable ui', {
					message: 'Waiting for other players to join'
                });

                log(UP, username, 'disable ui', {
					message: 'Waiting for other players to join'
                });
			} else {

				io.to(roomID).emit('enable ui', {
					message: "Let's go!"
                });

                log(UP, 'broadcast', 'enable ui', {
					message: "Let's go!"
                });
			}
		}
		
		if (!reConnected) {
            
            socket.emit('deal', {
				hand: hand.slice(0, 5)
            });
            
            log(UP, username, 'deal', {
				hand: hand.slice(0, 5)
            });

			if (thisCache.numUsers < 4) {

				socket.emit('disable ui', {
					message: 'Waiting for other players to join'
                });

                log(UP, username, 'disable ui', {
					message: 'Waiting for other players to join'
                });

			} else {
                thisCache.gameID = uid();
                thisCache.start_dt = Date.now();

                log(LOCAL, 'server', 'new game', {
                    roomID: roomID, gameID: thisCache.gameID
                });
                
                io.to(roomID).emit('enable ui', {
					message: "Let's go!"
                });
                log(UP, 'broadcast', 'enable ui', {
					message: "Let's go!"
                });

				thisCache.players.p1.socket.emit('choose bet', {
					highestBet: thisCache.highestBet
                });
                log(UP, thisCache.players.p1.username, 'choose bet', {
					highestBet: thisCache.highestBet
                });
			}
        }
        reConnected = false;
			
    });

    socket.on('bet', function(data) {
        log(DOWN, socket.username, 'bet', data);
        thisCache.players['p' + (thisCache.playerSequence.indexOf(socket.username) + 1)].bet = data.bet == "pass" ? 0:data.bet; 
        if (data.bet > thisCache.highestBet) {
            thisCache.highestBet = data.bet
            thisCache.highestBettor = socket.username
        }

        io.to(roomID).emit('bet', data)
        log(UP, 'broadcast', 'bet', data);

        if (thisCache.playerSequence.indexOf(socket.username) < thisCache.playerSequence.length - 1) {
            var nextPlayerSocket = thisCache.players['p' + (thisCache.playerSequence.indexOf(socket.username) + 2)].socket
            nextPlayerSocket.emit('choose bet', {
                highestBet: thisCache.highestBet
            })
            log(UP, nextPlayerSocket.username, 'choose bet', {
                highestBet: thisCache.highestBet
            });
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
            //xconsole.log('highest bettor', thisCache.players.p1.username)

            // for (var player in thisCache.players) {
            //     var soc = thisCache.players[player].socket;
            //     soc.emit('new sequence', {
            //         playerSequence: thisCache.playerSequence,
            //         playerNumber: thisCache.playerSequence.indexOf(thisCache.players[player].username) + 1,
            //         teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            //         teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            //         teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            //         teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
            //     });
            //     log(UP, soc.username, 'new sequence',{
            //         playerSequence: thisCache.playerSequence,
            //         playerNumber: thisCache.playerSequence.indexOf(thisCache.players[player].username) + 1,
            //         teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            //         teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            //         teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            //         teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
            //     });
            // }

            io.to(roomID).emit('new sequence', {
                playerSequence: thisCache.playerSequence,
                teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
            });
            log(UP, 'broadcast', 'new sequence', {
                playerSequence: thisCache.playerSequence,
                teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
            });


            thisCache.players.p1.socket.emit('choose trump', {
				chooseTrump: true,
				hand: '' 
            })
            log(UP, thisCache.players.p1.username, 'choose trump', {
                chooseTrump: true,
				hand: '' 
            });

            thisCache.players.p2.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p2.username].slice(5, 13)
            })
            log(UP, thisCache.players.p2.socket.username, 'deal',{
                hand: thisCache.usersCards[thisCache.players.p2.username].slice(5, 13)
            });
            thisCache.players.p3.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p3.username].slice(5, 13)
            })
            log(UP, thisCache.players.p3.socket.username, 'deal',{
                hand: thisCache.usersCards[thisCache.players.p3.username].slice(5, 13)
            });
            thisCache.players.p4.socket.emit('deal', {
                hand: thisCache.usersCards[thisCache.players.p4.username].slice(5, 13)
            })
            log(UP, thisCache.players.p4.socket.username, 'deal',{
                hand: thisCache.usersCards[thisCache.players.p4.username].slice(5, 13)
            });
        }
    });

    socket.on('trump card', function(data) {
        log(DOWN, socket.username, 'trump card', data);
        socket.broadcast.to(roomID).emit('trump setted', {
            data: 'budRangi'
        });
        log(UP, 'broadcast', 'trump setted', {
            data: 'budRangi'
        });
        
        socket.emit('trump card', {
            data: data
        });
        log(UP, socket.username, 'trump card', {
            data: data
        });
        socket.emit('deal', {
            hand: thisCache.usersCards[socket.username].slice(5, 14)
        });
        log(UP, socket.username, 'deal',{
            hand: thisCache.usersCards[socket.username].slice(5, 14)
        });
        socket.emit('your turn', {
            currentRoundSuit: '',
			totalRounds: thisCache.totalRounds,
			moodaCalled: thisCache.moodaCalled
        });
        log(UP, socket.username, 'your turn', {
            currentRoundSuit: '',
			totalRounds: thisCache.totalRounds,
			moodaCalled: thisCache.moodaCalled
        })
        thisCache.trumpCard = data;
        thisCache.usersCards[socket.username].splice(thisCache.usersCards[socket.username].indexOf(data), 1)
    });

    socket.on('card thrown', function(data) {
        // we tell the client to execute 'card thrown'
        log(DOWN, socket.username, 'card thrown', data);

        thisCache.turn++;
        //xconsole.log(socket.username, data)
        socket.broadcast.to(roomID).emit('card thrown', {
            username: socket.username,
            message: data,
            turn: thisCache.turn
        });
        log(UP, 'broadcast', 'card thrown', {
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
                Object.assign(thisCache.lastRoundObj, thisCache.currentRoundObj);
                thisCache.totalRounds++;
                
                var seniorArr = rules.getSenior(thisCache.currentRoundCards, thisCache.trumpRevealed, thisCache.trumpCard.charAt(0), thisCache.revealedInThis);
                var seniorCard = seniorArr[0];
                var seniorIndex = seniorArr[1];
                var seniorPlayer = Object.values(thisCache.currentRoundObj[seniorCard])[0];
                
                thisCache.currentRoundSuit = '';

                if (thisCache.trumpRevealed) {

                    if (thisCache.revealedInThis) {
                        thisCache.roundsSinceLastWin = thisCache.totalRounds;
                    } else {
                        thisCache.roundsSinceLastWin++;
                    }

                    var aceInThirdRound = (thisCache.totalRounds == 3 && seniorCard.split(/(\d+)/)[1] == 14) ? 1:0;  
                    var twoAcesCondition = rules.checkTwoAcesCondition(seniorCard, seniorPlayer, thisCache.lastRoundSeniorCard, thisCache.lastRoundSenior)
                    var winnerFlag = rules.getWinner(seniorIndex, thisCache.roundsSinceLastWin, thisCache.revealedInThis, thisCache.totalRounds, twoAcesCondition, aceInThirdRound);
                    
                    // var winnerFlag = rules.getWinner(seniorIndex, thisCache.roundsSinceLastWin, thisCache.revealedInThis, thisCache.totalRounds);
 
                }
                
                console.log(seniorCard, seniorPlayer, thisCache.lastRoundSeniorCard, thisCache.lastRoundSenior);
                thisCache.lastRoundSeniorCard = seniorArr[0];
                thisCache.lastRoundSenior = seniorPlayer;
            }
        }

        if (thisCache.turn == 4 && !winnerFlag) {

            io.to(roomID).emit('senior player', {
                username: thisCache.currentRoundObj[seniorCard],
                totalRounds: thisCache.totalRounds
            });
            log(UP, 'broadcast', 'card thrown', {
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
                if (roundWinner == thisCache.players.p1.username) {
                    thisCache.players.p1.handsPicked += thisCache.roundsSinceLastWin;
                } else {
                    thisCache.players.p3.handsPicked += thisCache.roundsSinceLastWin;
                }
            } else {
                thisCache.teamBHands += thisCache.roundsSinceLastWin;
                if (roundWinner == thisCache.players.p2.username) {
                    thisCache.players.p2.handsPicked += thisCache.roundsSinceLastWin;
                } else {
                    thisCache.players.p4.handsPicked += thisCache.roundsSinceLastWin;
                }
            }
            io.to(roomID).emit('hands picked', {
                username: roundWinner,
                handsPicked: thisCache.roundsSinceLastWin,
                totalRounds: thisCache.totalRounds,
                teamAHands: thisCache.teamAHands,
                teamBHands: thisCache.teamBHands
            });
            log(UP, 'broadcast', 'hands picked', {
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
                var msg = ''
                if (team == 'teamA') {
					msg = `${thisCache.playerSequence[0]} and ${thisCache.playerSequence[2]} won!`
					
					if (thisCache.moodaCalled) {
                        thisCache.players.p1.score += 52;
                        thisCache.winningTeamScore = 52;	
 					} else {
                        thisCache.players.p1.score += thisCache.teamAHands;
                        thisCache.winningTeamScore = thisCache.teamAHands;
                    }
                    thisCache.players.p1.wins += 1; 
                } else {
					msg = `${thisCache.playerSequence[1]} and ${thisCache.playerSequence[3]} won!`
					
					if (thisCache.moodaCalled) {
                        thisCache.players.p2.score += 52;
                        thisCache.winningTeamScore = 52;	
 					} else {
                        thisCache.players.p2.score += (thisCache.highestBet * 2)
                        thisCache.winningTeamScore = (thisCache.highestBet * 2);
					}
					
					thisCache.players.p2.wins += 1
                }
                
                thisCache.winningTeam = team;
                
                io.to(roomID).emit('winner announcement', {
                    message: msg,
                    teamAhands: thisCache.teamAHands,
                    teamBhands: thisCache.teamBHands,
                    teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                    teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                    teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                    teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
                });
                log(UP, 'broadcast', 'winner announcement', {
                    message: msg,
                    teamAhands: thisCache.teamAHands,
                    teamBhands: thisCache.teamBHands,
                    teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                    teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                    teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                    teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
                });

                addToQueue();

                setTimeout(function() {
                    if (thisCache.teamAHands >= thisCache.highestBet) {
                        redeal(roomID);
                    } else {
                        next(roomID);
                    }
                }, 5000);
                return
            }
        }

        if (thisCache.turn === 0) {
            setTimeout(function() {

                nextPlayerSocket.emit('your turn', {
                    currentRoundSuit: thisCache.currentRoundSuit,
					totalRounds: thisCache.totalRounds,
					moodaCalled: thisCache.moodaCalled
                });
                log(UP, nextPlayerSocket.username, 'your turn', {
                    currentRoundSuit: thisCache.currentRoundSuit,
                    totalRounds: thisCache.totalRounds,
                    moodaCalled: thisCache.moodaCalled
                });

            }, 3000)
        } else {
            nextPlayerSocket.emit('your turn', {
                currentRoundSuit: thisCache.currentRoundSuit,
				totalRounds: thisCache.totalRounds,
				moodaCalled: thisCache.moodaCalled
            });
            log(UP, nextPlayerSocket.username, 'your turn', {
                currentRoundSuit: thisCache.currentRoundSuit,
                totalRounds: thisCache.totalRounds,
                moodaCalled: thisCache.moodaCalled
            });
        }
    });

    socket.on('request trump', function() {
        //xconsole.log(socket.username + ' asked for trump');
        io.sockets.to(roomID).emit('request trump', {
            username: socket.username,
        });
        log(UP, 'broadcast', 'request trump', {
            username: socket.username,
        });
    });

    socket.on('reveal trump', function() {
        log(DOWN, socket.username, 'reveal trump', {})
        //xconsole.log('revealed trump');
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
        log(UP, 'broadcast', 'reveal trump', {
            username: socket.username,
            trumpCard: thisCache.trumpCard
        });
    });

    socket.on('mooda', function(data) {
		log(DOWN, socket.username, 'mooda', data)
        thisCache.usersCards[thisCache.players.p1.username].push(thisCache.trumpCard)
        for (var idx in thisCache.currentRoundCards) {
            thisCache.usersCards[thisCache.playerSequence[idx]].push(thisCache.currentRoundCards[idx])
            // var playerNumber = `p${(parseInt(idx)+1).toString()}`
            // thisCache.players[playerNumber].socket.emit('deal', {
            //     redeal: true,
            //     hand: thisCache.usersCards[thisCache.playerSequence[idx]]
            // })
        }
        
        thisCache.players.p1.socket.emit('deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p1.username]
        })
        log(UP, thisCache.players.p1.username, 'deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p1.username]
        })
        thisCache.players.p2.socket.emit('deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p2.username]
        })
        log(UP, thisCache.players.p2.username, 'deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p2.username]
        })
        thisCache.players.p3.socket.emit('deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p3.username]
        })
        log(UP, thisCache.players.p3.username, 'deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p3.username]
        })
        thisCache.players.p4.socket.emit('deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p4.username]
        })
        log(UP, thisCache.players.p4.username, 'deal', {
            redeal: true,
            hand: thisCache.usersCards[thisCache.players.p4.username]
        })


		// if (thisCache.currentRoundCards.length > 0 ) {
		// 	for (var idx in thisCache.currentRoundCards) {
		// 		thisCache.usersCards[thisCache.playerSequence[idx]].push(thisCache.currentRoundCards[idx])
		// 		var playerNumber = `p${(parseInt(idx)+1).toString()}`
		// 		//xconsole.log(playerNumber)
		// 		thisCache.players[playerNumber].socket.emit('deal', {
		// 			redeal: true,
		// 			hand: thisCache.usersCards[thisCache.playerSequence[idx]]
		// 		})
		// 	}
		// } else {
		// 	thisCache.players.p1.socket.emit('deal', {
		// 		redeal: true,
		// 		hand: thisCache.usersCards[thisCache.players.p1.username]
		// 	})
		// }
        
        thisCache.trumpRevealed = 1;
        thisCache.moodaCalled = true;
        thisCache.highestBet = 13;
        thisCache.highestBettor = socket.username;
        thisCache.moodaSuit = data.moodaSuit; //data.moodaSuit.charAt(0).toUpperCase();
        thisCache.trumpCard = data.moodaSuit.charAt(0).toUpperCase()+'14';
        thisCache.currentRoundSuit = '';
        thisCache.currentRoundObj = {};
        thisCache.turn = 0;
        thisCache.currentRoundCards = [];

        var n = thisCache.playerSequence.indexOf(thisCache.highestBettor);
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

        // for (var player in thisCache.players) {
        //     var soc = thisCache.players[player].socket;
        //     soc.emit('new sequence', {
        //         playerSequence: thisCache.playerSequence,
        //         teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
        //         teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
        //         teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
        //         teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
        //     });
        // }

        io.to(roomID).emit('new sequence', {
            playerSequence: thisCache.playerSequence,
            teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
        });
        log(UP, 'broadcast', 'new sequence', {
            playerSequence: thisCache.playerSequence,
            teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
        });

        io.to(roomID).emit('mooda', {
            username: socket.username,
            moodaSuit: thisCache.moodaSuit,
            reConnected: false
        });
        log(UP, 'broadcast', 'mooda', {
            username: socket.username,
            moodaSuit: thisCache.moodaSuit,
            reConnected: false
        });
        


        thisCache.players.p2.socket.emit('share cards', {
            partnerCards: thisCache.usersCards[thisCache.players.p4.username]
        })
        log(UP, thisCache.players.p2.socket.username, 'share cards', {
            partnerCards: thisCache.usersCards[thisCache.players.p4.username]
        })
        thisCache.players.p4.socket.emit('share cards', {
            partnerCards: thisCache.usersCards[thisCache.players.p2.username]
        })
        log(UP, thisCache.players.p4.socket.username, 'share cards', {
            partnerCards: thisCache.usersCards[thisCache.players.p2.username]
        })  

    })

    socket.on('accepted', function() {
        log(DOWN, socket.username, 'accepted', {})
		thisCache.moodaStatus.push('accepted');
		io.to(roomID).emit('accepted', {
			username: socket.username
        });
        log(UP, 'broadcast', 'accepted', {
			username: socket.username
        });

		if(thisCache.moodaStatus.length == 2) {
            thisCache.moodaAccepted = true;
			thisCache.players.p1.socket.emit('your turn', {
				currentRoundSuit: thisCache.currentRoundSuit,
				totalRounds: thisCache.totalRounds,
				moodaCalled: thisCache.moodaCalled
            })
            log(UP, thisCache.players.p1.socket, 'your turn', {
                currentRoundSuit: thisCache.currentRoundSuit,
                totalRounds: thisCache.totalRounds,
                moodaCalled: thisCache.moodaCalled
            });
		}
	})

	socket.on('rejected', function() {
        log(DOWN, socket.username, 'rejected', {})
		thisCache.moodaStatus.push('rejected');
		io.to(roomID).emit('rejected', {
			username: socket.username
        });
        log(UP, 'broadcast', 'rejected', {
			username: socket.username
        });

		if(thisCache.moodaStatus.length == 2) {
			var count = 0;
			var array = thisCache.moodaStatus;
			for(var i = 0; i < array.length; ++i) {
				if(array[i] == 'rejected') {
					count++;
				}
			}
			//xconsole.log(count)
			if (count == 2) {
				thisCache.teamAHands = 13;
				thisCache.players.p1.score += 26;
				thisCache.players.p1.wins += 1;
                thisCache.winningTeam = 'teamA';
                thisCache.winningTeamScore = 26;

                var msg = `${thisCache.playerSequence[0]} and ${thisCache.playerSequence[2]} won!`
        
				io.to(roomID).emit('winner announcement', {
                    message: msg,
                    teamAhands: thisCache.teamAHands,
                    teamBhands: thisCache.teamBHands,
                    teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                    teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                    teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                    teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
                });
                log(UP, 'broadcast', 'winner announcement', {
                    message: msg,
                    teamAhands: thisCache.teamAHands,
                    teamBhands: thisCache.teamBHands,
                    teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
                    teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
                    teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
                    teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
                });
                
                addToQueue();
                
				setTimeout(function() {
                        redeal(roomID);
                }, 5000);
				
			} else {
                thisCache.moodaAccepted = true;
				thisCache.players.p1.socket.emit('your turn', {
					currentRoundSuit: thisCache.currentRoundSuit,
					totalRounds: thisCache.totalRounds,
					moodaCalled: thisCache.moodaCalled
                })
                log(UP, thisCache.players.p1.socket, 'your turn', {
                    currentRoundSuit: thisCache.currentRoundSuit,
                    totalRounds: thisCache.totalRounds,
                    moodaCalled: thisCache.moodaCalled
                });
			}
		}

	})

    // when the user disconnects.. perform this
    socket.on('disconnect', function() {
        // log(DOWN, socket.username, 'disconnect', {})
        let message = ''
        const TIMEOUT = 60000

        if (addedUser) {
            log(DOWN, socket.username, 'disconnect', {})
            --thisCache.numUsers;
            
            if (thisCache.numUsers < 2) {
                reset(roomID)
            }
			
            message = `${socket.username} disconnected. Waiting for user to re-join in ${TIMEOUT/1000} seconds`

            // echo globally that this client has left
            io.to(roomID).emit('user left', {
                username: socket.username,
                numUsers: thisCache.numUsers,
                message: message,
                timeout: TIMEOUT
            });
            log(UP, 'broadcast', 'user left', {
                username: socket.username,
                numUsers: thisCache.numUsers,
                message: message,
                timeout: TIMEOUT
            });

            io.to(roomID).emit('disable ui', {
                message: 'Player disconnected'
            });
            log(UP, 'broadcast', 'disable ui', {
                message: 'Player disconnected'
            });
			
            thisCache.dcTimeOut = setTimeout(function() {
                reset(roomID);
			}, TIMEOUT)			
		
			if (thisCache.trumpCard === '' || (thisCache.moodaCalled && !thisCache.moodaAccepted)) {
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
            //xconsole.log(thisCache)
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
        thisCache.lastRoundSeniorCard = '';
        thisCache.highestBet = 7;
        thisCache.highestBettor = '';
		thisCache.moodaCalled = false;
        thisCache.moodaStatus = [];
        thisCache.moodaAccepted = false;
        thisCache.moodaSuit = '';
        thisCache.winningTeam = '';
        thisCache.winningTeamScore = 0;
        thisCache.players.p1.handsPicked = 0;
        thisCache.players.p2.handsPicked = 0;
        thisCache.players.p3.handsPicked = 0;
        thisCache.players.p4.handsPicked = 0;
        redeal(roomID);
    }

    function reset(roomID) {
        io.to(roomID).emit('reset');
        thisCache = {}
        cache.deleteRoom(roomID);
    }

    function redeal(roomID) {
        if (thisCache.numUsers < 4) return;
        thisCache.gameID = uid();
        
        log(LOCAL, 'server', 'new game', {
            roomID: roomID, gameID: thisCache.gameID
        });

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
        thisCache.lastRoundObj = {};
        thisCache.currentRoundObj = {};
        thisCache.currentRoundSuit;
        thisCache.roundsSinceLastWin = 0;
        thisCache.deck = require('./gameplay/deck').cards();
        thisCache.lastRoundSenior = '';
        thisCache.lastRoundSeniorCard = '';
        thisCache.highestBet = 7;
        thisCache.highestBettor = '';
		thisCache.moodaCalled = false;
        thisCache.moodaStatus = [];
        thisCache.moodaAccepted = false;
        thisCache.moodaSuit = ''
        thisCache.winningTeam = '';
        thisCache.winningTeamScore = 0;
        thisCache.players.p1.handsPicked = 0;
        thisCache.players.p2.handsPicked = 0;
        thisCache.players.p3.handsPicked = 0;
        thisCache.players.p4.handsPicked = 0;

        io.to(roomID).emit('redeal', {
            playerSequence: thisCache.playerSequence,
            teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
        });
        log(UP, 'broadcast', 'redeal', {
            playerSequence: thisCache.playerSequence,
            teamAwins: thisCache.players.p1.wins + thisCache.players.p3.wins,
            teamBwins: thisCache.players.p2.wins + thisCache.players.p4.wins,
            teamAscore: thisCache.players.p1.score + thisCache.players.p3.score,
            teamBscore: thisCache.players.p2.score + thisCache.players.p4.score
        });

        for (var player in thisCache.players) {
            var hand = deal(thisCache.deck);
            var soc = thisCache.players[player].socket;
            thisCache.usersCards[thisCache.players[player].username] = hand;
            
            soc.emit('deal', {
                hand: hand.slice(0, 5),
                redeal: true
            });
            log(UP, soc.username, 'deal', {
                hand: hand.slice(0, 5),
                redeal: true
            });
        }

        thisCache.players.p1.socket.emit('choose bet', {
            highestBet: thisCache.highestBet
        });
        log(UP, thisCache.players.p1.username, 'choose bet', {
            highestBet: thisCache.highestBet
        });
        thisCache.start_dt = Date.now();
       
    }

    async function addToQueue() {
        log(LOCAL, 'server', 'addToQueue', {
            roomID: roomID, gameID: thisCache.gameID
        });
        let gameObject = {};
        gameObject.end_dt = Date.now();
        gameObject.start_dt = thisCache.start_dt
        gameObject.gameID = thisCache.gameID
        gameObject.roomID = roomID
        gameObject.trumpCard = thisCache.trumpCard
        gameObject.moodaSuit = thisCache.moodaSuit
        gameObject.moodaCalled = thisCache.moodaCalled
        gameObject.moodaStatus  = thisCache.moodaStatus
        gameObject.moodaAccepted = thisCache.moodaAccepted
        gameObject.highestBet = thisCache.highestBet
        gameObject.players = {}
        for (let i=1; i<5; ++i) {
            gameObject.players[`p${i}`] = {}
            gameObject.players[`p${i}`].tricks = thisCache.players[`p${i}`].handsPicked
            gameObject.players[`p${i}`].username = thisCache.players[`p${i}`].username
            gameObject.players[`p${i}`].playerID = thisCache.players[`p${i}`].playerID
            gameObject.players[`p${i}`].bet = thisCache.players[`p${i}`].bet
            gameObject.players[`p${i}`].playerNum = i
        }

        if (thisCache.winningTeam == 'teamA') {
            gameObject.players.p1.score = thisCache.winningTeamScore
            gameObject.players.p3.score = thisCache.winningTeamScore
            gameObject.players.p1.result = 'won'
            gameObject.players.p3.result = 'won'
            gameObject.players.p2.score = 0
            gameObject.players.p4.score = 0
            gameObject.players.p2.result = 'lost'
            gameObject.players.p4.result = 'lost'
        } else {
            gameObject.players.p2.score = thisCache.winningTeamScore
            gameObject.players.p4.score = thisCache.winningTeamScore
            gameObject.players.p2.result = 'won'
            gameObject.players.p4.result = 'won'
            gameObject.players.p1.score = 0
            gameObject.players.p3.score = 0
            gameObject.players.p1.result = 'lost'
            gameObject.players.p3.result = 'lost'
        }

        const client = redis.createClient({
            host: keys.redisHost,
            port: keys.redisPort,
            retry_strategy: () => 1000
        });
        
        await client.rpush('queue', JSON.stringify(gameObject));
    }
    
    const getGameID = () => {
        if (typeof (thisCache.gameID) == 'undefined') {
            return '000-000-000'
        }

        return thisCache.gameID
    }

    const log = (type, target, event, data) =>{
        const gameID = getGameID();
        let dir;
        if (type == 'upstream') {
            dir = '->'
        } else if (type == 'downstream') {
            dir = '<-'
        } else {
            dir = '<>'
        }

        console.log(new Date(Date.now()).toISOString().replace(/T/, ' ').replace(/\..+/, ''), roomID, gameID, dir, `[${target}]`, `<${event}>`, JSON.stringify(data))
    }

    socket.on('message', function(data) {
        socket.broadcast.emit('message', {
            username: data.username,
            message: data.message
        })
    })

});
