// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var fs = require('fs');
var rules = require('./gameplay/rules.js');

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var deck = [];
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
var roundsSinceLastWin = 0;
var deckJargons = {14:"Ace", 13:"King", 12:"Queen", 11:"Jack", C:"Clubs", D:"Diamonds", S:"Spades", H:"Hearts"}

fs.readdir('public/images', function(err, items) {
    deck = items;
});

function deal() {
    var this_hand = [];
    for (var i=0; i<=12; i++) {
      var randomCard = deck.splice((Math.floor(Math.random() * deck.length)),1);
      this_hand.push(randomCard[0].split('.')[0]);
    }
    return this_hand;
}

io.on('connection', function (socket) {
  var addedUser = false;
 
  socket.on('card thrown', function (data) {
    // we tell the client to execute 'card thrown'
    socket.broadcast.emit('card thrown', {
      username: socket.username,
      message: data
    });

    usersCards[socket.username].splice(usersCards[socket.username].indexOf(data),1);

    turn++;
    
    if (turn <= 4) {
      currentRoundObj[data] = socket.username;
      currentRoundCards.push(data);
      if (turn==4) {
        totalRounds++;
        var seniorArr = rules.getSenior(currentRoundCards , trumpRevealed, trumpCard.charAt(0), revealedInThis);
        var seniorCard = seniorArr[0];
        var seniorIndex = seniorArr[1];
        if (trumpRevealed){
          
          if (revealedInThis) {
            roundsSinceLastWin = totalRounds;
          } else {
            roundsSinceLastWin++;
          }
          
          var winnerFlag = rules.getWinner(seniorIndex, roundsSinceLastWin, revealedInThis);
          
        }
        console.log(seniorCard);
      }
    }

    if (turn==4 && !winnerFlag) {
      io.sockets.emit('senior player', {
        username: currentRoundObj[seniorCard],
        totalRounds: totalRounds
      });
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
        handsPicked: roundsSinceLastWin,
        totalRounds: totalRounds,
        teamAHands: teamAHands,
        teamBHands: teamBHands
      });
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
      console.log(x);
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
      var hand = deal();
      usersCards[socket.username] = hand;
      if (numUsers <= 4) {
        players['p'+numUsers] = {username: socket.username, socket:socket, cardsInHand:hand}
        if (numUsers%2 == 1) {
          teamA.push(players[numUsers]);
        } else {
          teamB.push(players[numUsers]);
        }
      }
    } else {
      socket.username = username;
      var hand = usersCards[username];
    }
  
    socket.emit('login', {
      numUsers: numUsers
    });
    
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    }); 

    if (socket.username != players.p1.username){
      // send cards to socket
      socket.emit('deal', {
        'hand': hand
      });
    } else if (socket.username == players.p1.username && trumpCard == ""){
      // send player 1 cards to select trump
      var first5 = hand.splice(0,5);
      socket.emit('choose trump', {
        'hand': first5
      });
    } else {
      socket.emit('deal', {
        'hand': hand
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
   console.log(arr);
   if (arr[1]>10){
     arr[1]=deckJargons[1];
   }
   io.sockets.emit('reveal trump', {
     username: socket.username,
     trumpCard: (arr[1]+' of ' +deckJargons[arr[0]])
    });
  });

  socket.on('trump card', function (data) {
    console.log(('Trump setted '+ data));
    trumpCard = data;
    console.log(data);
    players.p1.socket.emit('deal', {
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
  });

  socket.on('disable', function (data) {
    console.log(('disable'));
    socket.emit('disable');
    });
});
