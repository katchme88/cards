// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var fs = require('fs');
var rules = require('./gameplay/rules.js');
var deck = require('./gameplay/deck.js').cards();
var shuffle = require('fisher-yates-shuffle');

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var usersCards = {};
var turn = 0;
var totalRounds = 0;

var players = {};
var teamA = [];
var teamB = [];
var teamAHands = 0;
var teamBHands = 0;
var trumpRevealed = 0;
var revealedInThis = 0;
var trumpCard = '';
var currentRoundCards = [];
var currentRoundObj = {};
var currentRoundSuit;
var roundsSinceLastWin = 0;
var playerSequence = [];
var deckJargons = {14:"Ace", 13:"King", 12:"Queen", 11:"Jack", C:"Clubs", D:"Diamonds", S:"Spades", H:"Hearts"}

function deal() {
    var this_hand = [];
    for (var i=0; i<=12; i++) {
      var randomCard = deck.splice((Math.floor(Math.random() * deck.length)),1);
      this_hand.push(randomCard[0]);
    }
    return this_hand;
}

io.on('connection', function (socket) {
  var addedUser = false;
 
  socket.on('card thrown', function (data) {
    // we tell the client to execute 'card thrown'
    
    turn++;

    socket.broadcast.emit('card thrown', {
      username: socket.username,
      message: data,
      turn: turn
    });

    usersCards[socket.username].splice(usersCards[socket.username].indexOf(data),1);

    if (turn==1){
      currentRoundSuit = data.split(/(\d+)/)[0];
      // console.log(currentRoundSuit);
    }
    
    if (turn <= 4) {

      currentRoundObj[data] = socket.username;
      currentRoundCards.push(data);
      var nextPlayerSocket = playerSequence.indexOf(socket.username) == 3 ? players.p1.socket : players['p'+ (playerSequence.indexOf(socket.username)+2)].socket;

      if (turn==4) {

        totalRounds++;
        var seniorArr = rules.getSenior(currentRoundCards , trumpRevealed, trumpCard.charAt(0), revealedInThis);
        var seniorCard = seniorArr[0];
        var seniorIndex = seniorArr[1];
        currentRoundSuit = '';
        
        if (trumpRevealed){
          
          if (revealedInThis) {
            roundsSinceLastWin = totalRounds;
          } else {
            roundsSinceLastWin++;
          }
          
          var winnerFlag = rules.getWinner(seniorIndex, roundsSinceLastWin, revealedInThis, totalRounds);
          
        }
      }
    }

    if (turn==4 && !winnerFlag) {
      io.sockets.emit('senior player', {
        username: currentRoundObj[seniorCard],
        totalRounds: totalRounds
      });
      nextPlayerSocket = players['p'+ (playerSequence.indexOf(currentRoundObj[seniorCard])+1)].socket;
      currentRoundObj = {};
      currentRoundCards = [];
      turn=0;
      revealedInThis=0;
    } else if (turn==4 && winnerFlag) {
      var roundWinner = currentRoundObj[seniorCard];
      if (players.p1.username == roundWinner || players.p3.username == roundWinner) {
        teamAHands+=roundsSinceLastWin;
      } else {
        teamBHands+=roundsSinceLastWin;
      }
      io.sockets.emit('hands picked', {
        username: roundWinner,
        handsPicked: roundsSinceLastWin,
        totalRounds: totalRounds,
        teamAHands: teamAHands,
        teamBHands: teamBHands
      });
      nextPlayerSocket = players['p'+ (playerSequence.indexOf(currentRoundObj[seniorCard])+1)].socket;
      var x = {
        handsPicked: roundsSinceLastWin,
        totalRounds: totalRounds,
        teamAHands: teamAHands,
        teamBHands: teamBHands
      };
      roundsSinceLastWin = 0;
      turn=0;
      revealedInThis=0;
      currentRoundObj = {};
      currentRoundCards = [];
    }

    if (turn === 0){
      setTimeout(function() {
        nextPlayerSocket.emit('your turn', {
          currentRoundSuit: currentRoundSuit
        });
      },4000)
    } else {
      nextPlayerSocket.emit('your turn', {
        currentRoundSuit: currentRoundSuit
      });
    }    
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;
    // we store the username in the socket session for this client
    if (!(username in usersCards)) {
      socket.username = username;
      ++numUsers;
      addedUser = true;
      var hand = deal(deck);
      usersCards[socket.username] = hand;
      if (numUsers <= 4) {
        players['p'+numUsers] = {username: socket.username, socket:socket, cardsInHand:hand}
        playerSequence.push(username);
        playerNumber = playerSequence.indexOf(socket.username) + 1
      }
    } else {
      socket.username = username;
      var hand = usersCards[username];
      ++numUsers;
    }

    socket.emit('login', {
      numUsers: numUsers,
      playerNumber: playerSequence.indexOf(socket.username) + 1,
      playerSequence: playerSequence
    });
    
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      playerSequence: playerSequence
    }); 

    if (socket.username != players.p1.username){
      // send cards to socket
      socket.emit('deal', {
        hand: hand
      });
    } else if (socket.username == players.p1.username && trumpCard == ""){
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

    if (numUsers < 4) {
      socket.emit('disable ui', {
        message: 'Waiting for other players to join' 
      });
    } else {
      io.sockets.emit('enable ui', {
        message: "Let's go!" 
      });
    }
  });

  socket.on('request trump', function () {
   console.log(socket.username+' asked for trump');
   io.sockets.emit('request trump', {
      username:socket.username, 
    });
  });

  socket.on('reveal trump', function () {
   console.log('revealed trump');
   revealedInThis = turn;
   trumpRevealed = 1;
   var arr = trumpCard.split(/(\d+)/) ;
  //  console.log(arr);
   if (arr[1]>10){
     arr[1]=deckJargons[arr[1]];
   }
   io.sockets.emit('reveal trump', {
     username: socket.username,
     trumpCard: trumpCard
    });
  });

  socket.on('trump card', function (data) {
    console.log(('Trump setted '+ data));
    trumpCard = data;
    // console.log(data);
    socket.broadcast.emit('trump setted', {
      data: 'budRangi'
    });
    players.p1.socket.emit('deal', {
      hand: usersCards[players.p1.username]
    });
    players.p1.socket.emit('your turn', {
      hand: usersCards[players.p1.username]
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }

    io.sockets.emit('disable ui', {
      message: 'Player disconnected' 
    });

  });

  socket.on('command', function (data) {
    if (data.command==='next'){
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
      console.log(playerSequence);
      redeal();
    }
    
    if (data.command==='redeal'){
      redeal();
    }
  });

  function redeal () {
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

});
