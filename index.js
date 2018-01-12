// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var fs = require('fs');

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
var totalTurns = 0;
var gamePlay = {};
var players = {};
var teamA = [];
var teamB = [];
var trumpRevealed = 0;

fs.readdir('public/images', function(err, items) {
    deck = items;
});

function deal(){
    var this_hand = [];
    for (var i=0; i<=12; i++){
      var randomCard = deck.splice((Math.floor(Math.random() * deck.length)),1);
      this_hand.push(randomCard[0].split('.')[0]);
      
    }
    //console.log(this_hand);
    return this_hand.sort();
}

function getSenior(data) {
  currentSuite = Object.keys(data)[0].charAt(0);
  console.log(('currentsuite:'+currentSuite));
  if (!trumpRevealed){
    var x = (Object.keys(data)[1].charAt(0) == currentSuite);
    var y = (Object.keys(data)[2].charAt(0) == currentSuite);
    var z = (Object.keys(data)[3].charAt(0) == currentSuite);
    if (x && y && z){
      return data[Object.keys(data).sort()[3]];
    }
    if (x && y && !z){
      console.log('z deleted');
      delete data[Object.keys(data)[3]];
      return data[Object.keys(data).sort()[2]];
    }
    if (x && !y && z){
      console.log('y deleted');
      delete data[Object.keys(data)[2]];
      return data[Object.keys(data).sort()[2]];
    }
    if (!x && y && z){
      console.log('x deleted');
      delete data[Object.keys(data)[1]];      
      return data[Object.keys(data).sort()[2]];
    }
    if (x && !y && !z){
      console.log('yz deleted');
      delete data[Object.keys(data)[2]];
      delete data[Object.keys(data)[2]];      
      return data[Object.keys(data).sort()[1]];
    }
    if (!x && !y && z){
      console.log('xy deleted');
      delete data[Object.keys(data)[1]];
      delete data[Object.keys(data)[1]];      
      return data[Object.keys(data).sort()[1]];
    }
    if (!x && y && !z){
      console.log('xz deleted');
      delete data[Object.keys(data)[1]];
      delete data[Object.keys(data)[2]];
      return data[Object.keys(data).sort()[1]];
    }
    if (!x && !y && !z){
      console.log('xyz deleted');
      return data[Object.keys(data).sort()  [0]];
    }
  }
  
}

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  socket.on('card thrown', function (data) {
    // we tell the client to execute 'card thrown'
    turn++;
    if (turn <= 4){
      gamePlay[data] = socket.username;
      if (turn==4){
        turn = 0;
        totalTurns++;
        var seniorPlayer = getSenior(gamePlay);
        console.log(seniorPlayer);
        gamePlay = {};
      }
    }


    socket.broadcast.emit('card thrown', {
      username: socket.username,
      message: data
    });
    usersCards[socket.username].splice(usersCards[socket.username].indexOf(data),1);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    if (!(username in usersCards)){
      socket.username = username;
      ++numUsers;
      addedUser = true;
      var hand = deal();
      usersCards[socket.username] = hand;
      if (numUsers <= 4){
        players[numUsers] = {name:socket.username, cardsInHand:hand}
        if (numUsers%2 == 1){
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
    
    // send card to socket
    socket.emit('deal', {
      'hand': hand
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
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
