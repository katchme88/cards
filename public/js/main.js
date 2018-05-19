$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];
  var CIH_TOPS = {
    'cih-0':'58%','cih-1':'53%','cih-2':'49%',
    'cih-3':'46%','cih-4':'43%','cih-5':'42%',
    'cih-6':'42%','cih-7':'43%','cih-8':'46%',
    'cih-9':'48%','cih-10':'52%','cih-11':'56%',
    'cih-12':'62.5%'};

  // Initialize variables
  var $window = $(window);
  var $document = $(document);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  // var $logs = $('.logs'); //log messages
  var $inputMessage = $('.inputMessage'); // Input message input box
  //var $revealTrump = $('.revealTrump');
  var $requestTrump = $('.requestTrump');
  var $trumpCard = $('.trumpCard');
  var $requestORtrump = $('.requestOrtrump'); 
  var $disable = $('.disable');
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var $overlay = $('#overlay');
  var $overlayText = $('#overlayText');

  var $cards_in_hand = $('.cards-in-hand');
  var choosingTrump = false;
  var trumpCard = "";
  var currentRoundSuit;
  var trumpAsked = false;
  var trumpRevealed = false;

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();
  var myTurn = false;
  var cardsInHand = [];
  var suitsInHand = [];
  var playerNumber;
  var audio_throw = new Audio("sounds/cardPlace1.wav");
  var audio_ding = new Audio("sounds/ding.wav");
  
  var playerSequence=[];
  var playerPerspective = [];
  var turn = 0;

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    // log(message);
  }

  function showOverlay (data) {
    $('.overlay').html('<p>'+data+'</p>').fadeIn(1000);
    setTimeout(function(){
      $('.overlay').fadeOut(500);
    },3000);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());
    username = username.toUpperCase();
    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  function throwCard (id, budRungi) {
    var message = id;
    if (message && connected) {
      // tell server to execute 'card thrown' and send along one parameter
      cardsInHand.splice(cardsInHand.indexOf(message), 1);
      updateSuitsInHand(cardsInHand);
      
      //throw a budrungi if budRungi is true
      message = budRungi ? 'budRungi' : message;
      animateThrowCard (id, budRungi);
      socket.emit('card thrown', message);
      turn++;
    }
  }

  function animateThrowCard (id, budRungi) {
    var posLeft = 168;
    var $el = $('#'+id);
    var new_left = posLeft - $el.position().left;
    $el.animate({top:'-86%', left:new_left, height:"80%"}, function() {
        $el.remove();
        id = budRungi ? 'budRungi' : id;
        $('.middle.table').append('<img id="card-1" class="tableCard" src="images/cards/'+id+'.png" />');
        updateNextAvatar(1);
    });
  }

  function updateNextAvatar(num) {
    var next = (num+1).toString();
    $(".avatar > img").css({'border': '0px solid white'});
    $(".avatar-"+next+" > img").css({'border': '5px solid gold'});
  }

  function indicateTrumpCaller(num){
    var next = (num+1).toString();
    $(".avatar-"+next).css({'background-color': 'red'});
  }

  function updatePlayerName(perspective) {
    for (var i = 0; i < perspective.length; i++) {
      $(".name-"+(i+1)).html("<center><b>"+perspective[i]+"</b></center>");
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addLogElement($el, options);
  }

  
  // Adds the thrown card on to the message list
  function addCard (data, options) {
    audio_throw.play();
    var perspective = playerPerspective.indexOf(data.username) + 1;
    var animateObj = {};
    var avatarNum = 0;
    switch(perspective) {
      case 2:
        animateObj = {right:'32%'};
        break;
      case 3:
        animateObj = {bottom:'55%'};
        break;
      case 4:
        animateObj = {right:'56%'};
        break;
      default:
        animateObj = {};
  }
    $('.middle.table').append('<img id="card-'+perspective+'" class="tableCard" src="images/cards/'+data.message+'.png" />');
    $('#card-'+perspective).animate(animateObj);
    updateNextAvatar(perspective);
  }

  function sendTrumpCard (id) {
    var message = id;
    if (message && connected) {
      socket.emit('trump card', message);
    }
  }

  function addTrumpElement (id) {
    choosingTrump = false;
    $requestTrump.hide();
    $trumpCard.html('<img id="'+id+'" src="images/cards/'+id+'.png"></img>');
  }

  function addRequestTrumpElement (id) {
    $trumpCard.hide();
    $requestTrump.html('<img id="'+id+'" src="images/cards/'+id+'.png"></img>');
  }

  function updateSuitsInHand (cardsInHand) {
    var arr = [];
    suitsInHand = [];
    for (var i in cardsInHand){
      arr.push(cardsInHand[i].split(/(\d+)/)[0]);
    }

    $.each(arr, function(i, el){
      if($.inArray(el, suitsInHand) === -1) suitsInHand.push(el);
    });
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).html();
  }

  // draw cards on screen
  function drawCardsInHand (data) {
    //(data.hand).sort();
    cardsInHand = cardsInHand.concat(data.hand);
    cardsInHand.sort();
    $('.card-in-hand').remove();
    for(var i in cardsInHand){
      $cards_in_hand.append("<div class='card-in-hand cih-"+i+"' id='"+cardsInHand[i]+"'><img src='images/cards/"+cardsInHand[i]+".png' \/></div>");
      
    }
    updateSuitsInHand(cardsInHand);
  }

  function addPlayerElement (data) {
    for (i in data) {
      var element = $('.player-'+(parseInt(i)+1));
      element.text(data[i]);
    }
  }

  function getPlayerPerspective (data) {
    var perspective = data.slice();
    var mySeq = perspective.indexOf(username);
    for (var i=0; i < mySeq; i++) {
        perspective.push(perspective.shift());
    }
    return perspective;
  }

  function clearTable (username) {
    setTimeout(function () 
      {
        $(".tableCard").remove();
        updateNextAvatar(playerPerspective.indexOf(username));
      }, 2000);
  }

  function vibrateCard(el) {
    el.effect("shake",{"distance":5});
  }
  // Keyboard events
  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {

  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  //#########################################################################################
  // Socket events
  //#########################################################################################

  
  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    // var message = "Cards.IO";
    // log(message, {
    //   prepend: true
    // });
    playerNumber = data.playerNumber;
    playerSequence = data.playerSequence;
    addPlayerElement(playerSequence);
    playerPerspective = getPlayerPerspective(playerSequence);
    updatePlayerName(playerPerspective);
    if (playerSequence.length == 4) {
      updateNextAvatar(playerPerspective.indexOf(playerSequence[0]));
      indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
    }
    addParticipantsMessage(data);
    // if (playerNumber == 1 || playerNumber == 3){
    //   $requestTrump.hide();
    // }
  });


  // Whenever the server emits 'card thrown', update the gameplay body
  socket.on('card thrown', function (data) {
    addCard(data);
    turn = data.turn;
  });

  socket.on('senior player', function (data) {
    clearTable(data.username);
  });
  
  socket.on('hands picked', function (data){
    $(".score").text((data.teamAHands + " - " + data.teamBHands));
    var winner = playerSequence.indexOf(data.username)+1;
    var msg = '';
    if (playerNumber === winner || playerNumber === winner+2 || playerNumber === winner-2) {
      msg = 'Your team picked '+data.handsPicked+' hands';
    } else {
      msg = 'Your opponents picked '+data.handsPicked+' hands';
    }
    showOverlay(msg);
    clearTable(data.username);
    
  });

  socket.on("request trump", function(data) {
    trumpAsked = true;
    $('.trumpCard > img').trigger("click");
    showOverlay(data.username+ ' opened the trump');
  });

  socket.on("reveal trump", function(data) {
    // log(("The trump is " + data.trumpCard));
    $requestTrump.html('<img src="images/cards/'+data.trumpCard+'.png"></img>');

  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    audio_ding.play();
    addParticipantsMessage(data);
    playerSequence = data.playerSequence;
    playerPerspective = getPlayerPerspective(playerSequence);
    updatePlayerName(playerPerspective);
    if (playerSequence.length == 4) {
      updateNextAvatar(playerPerspective.indexOf(playerSequence[0]));
      indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
    }
    addPlayerElement(playerSequence);
  });

  // draw the received cards on screen
  socket.on('deal', function (data) {
    drawCardsInHand(data);
  });
  
  // Your turn
   socket.on('your turn', function (data) {
    myTurn = true;
    currentRoundSuit = data.currentRoundSuit;
    updateNextAvatar(0);
  });

  // draw cards and ask him to choose trump
  socket.on('choose trump', function (data) {
    drawCardsInHand(data);
    showOverlay('You can click to choose the trump when all players have joined');
    choosingTrump = true; 
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    // log(data.username + ' left');
    addParticipantsMessage(data);
    // removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    // log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    // log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    // log('attempt to reconnect has failed');
  });

  socket.on('disable ui', function (data) {
    $document.off('click');
    //showOverlay(data.message);
  });

  socket.on('trump setted', function(data){
    showOverlay(playerSequence[0]+' has chosen the trump');
    addRequestTrumpElement('budRungi');
  });

  socket.on('enable ui', function (data) {
    $document.on("click", ".card-in-hand" , function() {
      updateSuitsInHand(cardsInHand);
      var found = suitsInHand.find(function(element) {
          return element == currentRoundSuit;
      });

      if (myTurn && found && $(this).attr('id')[0] != currentRoundSuit) {
        vibrateCard($(this));
        showOverlay('Throw correct suit');
        return;
      }

      if (!choosingTrump && !myTurn) {
        vibrateCard($(this));
        showOverlay('Wait for your turn');
        return;
      }

      if ($(this).hasClass('co')) {
        if (choosingTrump) {
            sendTrumpCard($(this).attr('id'));
            addTrumpElement($(this).attr('id'));
            cardsInHand.splice(cardsInHand.indexOf($(this).attr('id')),1);
            updateSuitsInHand(cardsInHand);
            $(this).remove();
        } else if (currentRoundSuit && myTurn) {
          updateSuitsInHand(cardsInHand);
          var found = suitsInHand.find(function(element) {
              return element == currentRoundSuit;
          });
            if ( found && $(this).attr('id')[0] == currentRoundSuit) {
              throwCard($(this).attr('id'));
              myTurn = false;
            } else if (!found){
              var budRungi = playerNumber == 1 && trumpRevealed == false ? true : false;
              throwCard($(this).attr('id'), budRungi);
              //$(this).remove();
              myTurn = false;
            } else {
            }
          
          } else if (!currentRoundSuit && myTurn) {
            throwCard($(this).attr('id'));
            myTurn = false;
          } else {
            showOverlay('Wait for your turn');
        }
      } else {
          $(this).addClass('co').animate({top:0});
          var str = $(this).siblings('.co').attr('class');
        if (str) {
          $(this).siblings('.co').animate({top:CIH_TOPS[str.split(' ')[1]]});
          $(this).siblings('.co').removeClass('co');
        }
      }
    });


    $document.on("click", ".trumpCard > img" , function() {
      if (trumpAsked) {
        socket.emit('reveal trump');
        cardsInHand.push($(this).attr('id'));
        updateSuitsInHand(cardsInHand);
        $cards_in_hand.append("<div class='card-in-hand' id='"+$(this).attr('id')+"'><img src='images/cards/"+$(this).attr('id')+".png' /></div>");
        $(this).remove();
        trumpRevealed = true;
      } else {
        vibrateCard($(this));
        showOverlay('you can\'t open trump card at this stage');
      }
    });

    $document.on("click", ".requestTrump > img" , function() {
      updateSuitsInHand(cardsInHand);
      var found = suitsInHand.find(function(element) {
          return element == currentRoundSuit;
      });
      if (!found && myTurn && currentRoundSuit && playerNumber != 3 ) {
        socket.emit('request trump');
      } else if (playerNumber===3) {
        vibrateCard($(this));
        showOverlay('your partner is the trump caller');
      } else {
        vibrateCard($(this));
        showOverlay('you can\'t request for trump card at this stage');
      }
    });
    // showOverlay(data.message);
   });

});
