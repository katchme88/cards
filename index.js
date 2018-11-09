// Setup basic express server
"use strict";
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var fs = require('fs');
var rules = require('./gameplay/rules.js');
//var deck = require('./gameplay/deck.js').cards();
// var shuffle = require('fisher-yates-shuffle');
let cache = require('./cache');

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

let deckJargons = {14:"Ace", 13:"King", 12:"Queen", 11:"Jack", C:"Clubs", D:"Diamonds", S:"Spades", H:"Hearts"}

function deal(deck) {
    var this_hand = [];
    for (var i=0; i<=12; i++) {
      var randomCard = deck.splice(0,1);
      this_hand.push(randomCard[0]);
    }
    return this_hand;
}

io.on('connection', function (socket) {
  var addedUser = false;
  let thisCache;
  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;
    let roomID = cache.addUser(socket);
    socket.roomID = roomID;
    socket.join(roomID);
    thisCache = cache.getGameCache(roomID);
    //Let additional users know that a game is in progress
    if (thisCache.numUsers === 4) {socket.to(socket.roomID).emit('room full'); return;}

    // we store the username in the socket session for this client

    if (!(username in thisCache.usersCards)) {
      socket.username = username;
      ++thisCache.numUsers;
      ++thisCache.totalUsers;
      addedUser = true;
      var hand = deal(thisCache.deck);
      thisCache.usersCards[socket.username] = hand;
      if (thisCache.numUsers <= 4) {
        thisCache.players['p'+thisCache.numUsers] = {username: socket.username, socket:socket, cardsInHand:hand}
        thisCache.playerSequence.push(username);
        //playerNumber = thisCache.playerSequence.indexOf(socket.username) + 1
      }
    } else {
      socket.username = username;
      var hand = thisCache.usersCards[username];
      ++thisCache.numUsers;
    }

    socket.emit('login', {
      numUsers: thisCache.numUsers,
      playerNumber: thisCache.playerSequence.indexOf(socket.username) + 1,  
      playerSequence: thisCache.playerSequence
    });
    
    // echo globally (all clients) that a person has connected
    socket.broadcast.to(socket.roomID).emit('user joined', {
      username: socket.username,
      numUsers: thisCache.numUsers,
      playerSequence: thisCache.playerSequence
    }); 
    // console.log(players);
    if (socket.username != thisCache.players.p1.username){
      // send cards to socket
      socket.emit('deal', {
        hand: hand
      });
    } else if (socket.username == thisCache.players.p1.username && thisCache.trumpCard == ""){
      // send player 1 cards to select trump
      var first5 = hand.splice(0,5);
      socket.emit('choose trump', {
        hand: first5
      });
    } else {
      socket.emit('deal', {
        hand: hand
      });
    }

    if (thisCache.numUsers < 4) {
      socket.emit('disable ui', {
        message: 'Waiting for other players to join' 
      });
    } else {
      io.sockets.emit('enable ui', {
        message: "Let's go!" 
      });
    }
  });

  socket.on('trump card', function (data) {
    console.log(('Trump setted '+ data));
    thisCache.trumpCard = data;
    // console.log(data);
    socket.broadcast.to(socket.roomID).emit('trump setted', {
      data: 'budRangi'
    });
    thisCache.players.p1.socket.emit('deal', {
      hand: thisCache.usersCards[thisCache.players.p1.username]
    });
    thisCache.players.p1.socket.emit('your turn', {
      hand: thisCache.usersCards[thisCache.players.p1.username]
    });
  });

  socket.on('card thrown', function (data) {
    // we tell the client to execute 'card thrown'
    
    thisCache.turn++;

    socket.broadcast.to(socket.roomID).emit('card thrown', {
      username: socket.username,
      message: data,
      turn: thisCache.turn
    });

    thisCache.usersCards[socket.username].splice(thisCache.usersCards[socket.username].indexOf(data),1);

    if (thisCache.turn==1){
      thisCache.currentRoundSuit = data.split(/(\d+)/)[0];
      // console.log(currentRoundSuit);
    }
    
    if (thisCache.turn <= 4) {

      thisCache.currentRoundObj[data] = socket.username;
      thisCache.currentRoundCards.push(data);
      var nextPlayerSocket = thisCache.playerSequence.indexOf(socket.username) == 3 ? thisCache.players.p1.socket : thisCache.players['p'+ (thisCache.playerSequence.indexOf(socket.username)+2)].socket;

      if (thisCache.turn==4) {

        thisCache.totalRounds++;
        var seniorArr = rules.getSenior(thisCache.currentRoundCards , thisCache.trumpRevealed, thisCache.trumpCard.charAt(0), thisCache.revealedInThis);
        var seniorCard = seniorArr[0];
        var seniorIndex = seniorArr[1];
        thisCache.currentRoundSuit = '';
        
        if (thisCache.trumpRevealed){
          
          if (thisCache.revealedInThis) {
            thisCache.roundsSinceLastWin = thisCache.totalRounds;
          } else {
            thisCache.roundsSinceLastWin++;
          }
          
          var winnerFlag = rules.getWinner(seniorIndex, roundsSinceLastWin, revealedInThis, totalRounds);
          
        }
      }
    }

    if (thisCache.turn==4 && !winnerFlag) {
      io.sockets.emit('senior player', {
        username: thisCache.currentRoundObj[seniorCard],
        totalRounds: thisCache.totalRounds
      });
      nextPlayerSocket = thisCache.players['p'+ (thisCache.playerSequence.indexOf(thisCache.currentRoundObj[seniorCard])+1)].socket;
      thisCache.currentRoundObj = {};
      thisCache.currentRoundCards = [];
      thisCache.turn=0;
      thisCache.revealedInThis=0;
    } else if (thisCache.turn==4 && winnerFlag) {
      var roundWinner = thisCache.currentRoundObj[seniorCard];
      if (thisCache.players.p1.username == roundWinner || thisCache.players.p3.username == roundWinner) {
        thisCache.teamAHands+=roundsSinceLastWin;
      } else {
        thisCache.teamBHands+=thisCache.roundsSinceLastWin;
      }
      io.sockets.to(socket.roomID).emit('hands picked', {
        username: roundWinner,
        handsPicked: roundsSinceLastWin,
        totalRounds: totalRounds,
        teamAHands: teamAHands,
        teamBHands: teamBHands
      });
      nextPlayerSocket = thisCache.players['p'+ (thisCache.playerSequence.indexOf(thisCache.currentRoundObj[seniorCard])+1)].socket;
      var x = {
        handsPicked: roundsSinceLastWin,
        totalRounds: totalRounds,
        teamAHands: teamAHands,
        teamBHands: teamBHands
      };
      thisCache.roundsSinceLastWin = 0;
      thisCache.turn=0;
      thisCache.revealedInThis=0;
      thisCache.currentRoundObj = {};
      thisCache.currentRoundCards = [];

      if (thisCache.teamAHands >= 7 || thisCache.teamBHands >=7) {
        var team = thisCache.teamAHands >= 7 ? 'teamA':'teamB';
        io.to(socket.roomID).emit('winner announcement', {
          winner: team
        });  

        setTimeout(function () { 
          if (thisCache.teamAHands >= 7) {
            redeal();
          } else {
            next();
          }
        }, 5000);

      }
    }

    if (thisCache.turn === 0){
      setTimeout(function() {
        nextPlayerSocket.emit('your turn', {
          currentRoundSuit: thisCache.currentRoundSuit
        });
      },3000)
    } else {
      nextPlayerSocket.emit('your turn', {
        currentRoundSuit: thisCache.currentRoundSuit
      });
    }    
  });

  socket.on('request trump', function () {
   console.log(socket.username+' asked for trump');
   io.sockets.to(socket.roomID).emit('request trump', {
      username:socket.username, 
    });
  });

  socket.on('reveal trump', function () {
   console.log('revealed trump');
   revealedInThis = thisCache.turn;
   thisCache.trumpRevealed = 1;
   var arr = thisCache.trumpCard.split(/(\d+)/) ;
  //  console.log(arr);
   if (arr[1]>10){
     arr[1]=deckJargons[arr[1]];
   }
   io.sockets.emit('reveal trump', {
     username: socket.username,
     trumpCard: thisCache.trumpCard
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      // --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: thisCache.numUsers
      });
      socket.broadcast.emit('disable ui', {
        message: 'Player disconnected' 
      });
      //reset();
    }

  });

  socket.on('command', function (data) {
    if (data.command==='next'){
      next();
    }
    
    if (data.command==='redeal'){
      redeal();
    }

    if (data.command==='reset'){
      reset();
    }

    if (data.command==='team'){
      changeTeam();
    }

  });

  function changeTeam() {
    if (numUsers < 4) return;
    var p1 = players.p1;
    var p2 = players.p3;
    var p3 = players.p2;
    var p4 = players.p4;
    
    var a = playerSequence[1];
    var b = playerSequence[2];
    playerSequence[1] = b;
    playerSequence[2] = a;

    players = {}
    players['p1'] = p1;
    players['p2'] = p2;
    players['p3'] = p3;
    players['p4'] = p4;
    
    redeal();
  }

  function next() {
    if (numUsers < 4) return;
    var p1 = players.p2;
    var p2 = players.p3;
    var p3 = players.p4;
    var p4 = players.p1;
    players = {}
    players['p1'] = p1;
    players['p2'] = p2;
    players['p3'] = p3;
    players['p4'] = p4;
    playerSequence.push(playerSequence.shift());
    redeal();
  }

  function reset () { 
    io.emit('reset');
    usersCards = {};
    turn = 0;
    totalRounds = 0;
    teamA = [];
    teamB = [];
    teamAHands = 0;
    teamBHands = 0;
    trumpRevealed = 0;
    revealedInThis = 0;
    trumpCard = '';
    currentRoundCards = [];
    currentRoundObj = {};
    currentRoundSuit;
    roundsSinceLastWin = 0;
    playerSequence = [];
    players = {};
    deck = require('./gameplay/deck.js').cards();
    numUsers = 0;
  }

  function redeal () {
    if (numUsers < 4) return;
    usersCards = {};
    turn = 0;
    totalRounds = 0;
    teamA = [];
    teamB = [];
    teamAHands = 0;
    teamBHands = 0;
    trumpRevealed = 0;
    revealedInThis = 0;
    trumpCard = '';
    currentRoundCards = [];
    currentRoundObj = {};
    currentRoundSuit;
    roundsSinceLastWin = 0;
    deck = require('./gameplay/deck.js').cards();

    for (var player in players) {
      var hand = deal();
      var soc = players[player].socket;
      usersCards[players[player].username] = hand;

      soc.emit('redeal', {
        playerSequence: playerSequence,
        playerNumber: playerSequence.indexOf(players[player].username)+1
      });
      
      if (player === 'p1') {
        first5 = hand.splice(0,5);

        soc.emit('choose trump', {
          hand: first5,
          redeal: true
        });

        continue;
      }

      soc.emit('deal', {
        hand: hand,
        redeal: true
      });
    }
  }

  socket.on('message', function(data) {
    socket.broadcast.emit('message', {
      username:data.username,
      message: data.message
    })
  }) 

});
