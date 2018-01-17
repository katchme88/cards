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
var currentRoundObj = {};
var players = {};
var teamA = [];
var teamB = [];
var trumpRevealed = 0;
var revealedInThis = 0;
var trumpSuit = '';
var currentRoundCards = [];

fs.readdir('public/images', function(err, items) {
    deck = items;
});

function deal() {
    var this_hand = [];
    for (var i=0; i<=12; i++) {
      var randomCard = deck.splice((Math.floor(Math.random() * deck.length)),1);
      this_hand.push(randomCard[0].split('.')[0]);
    }
    return this_hand.sort();
}

io.on('connection', function (socket) {
  var addedUser = false;
 
  socket.on('card thrown', function (data) {
    // we tell the client to execute 'card thrown'
    turn++;
    if (turn <= 4) {
      currentRoundObj[data] = socket.username;
      currentRoundCards.push(data);
      if (turn==4) {
        totalRounds++;
        var seniorCard = rules.getSenior(currentRoundCards , trumpRevealed, trumpSuit, revealedInThis);
        console.log(seniorCard);
      }
    }

    socket.broadcast.emit('card thrown', {
      username: socket.username,
      message: data
    });

    if(turn==4){
      io.sockets.emit('senior player', currentRoundObj[seniorCard[0]]);
      currentRoundObj = {};
      currentRoundCards = [];
      turn=0;
      revealedInThis=0;
    }
    usersCards[socket.username].splice(usersCards[socket.username].indexOf(data),1);
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

    if (numUsers > 1){
      // send cards to socket
      socket.emit('deal', {
        'hand': hand
      });
    } else {
      // send player 1 cards to select trump
      var first5 = hand.splice(8,5);
      socket.emit('choose trump', {
        'hand': first5
      });
    }
  });

  socket.on('ask trump', function () {
   console.log(socket.username+' asked for trump');
   io.sockets.emit('ask trump', {
      username:socket.username, 
    });
  });

  socket.on('reveal trump', function () {
   console.log('revealed trump');
   revealedInThis = turn;
   trumpRevealed = 1;
   console.log(revealedInThis);
   socket.broadcast.emit('reveal trump', {
     username: socket.username,
     trumpSuit: trumpSuit
    });
  });

  socket.on('trump card', function (data) {
    console.log(('Trump setted '+ data));
    trumpSuit = data.charAt(0);
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
});
