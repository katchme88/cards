$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

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
  var audio = new Audio("sounds/cardPlace1.wav");
  var playerSequence=[];
  var playerPerspective = [];

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

  function showOverlay (bool, data) {
    if (bool) {
      $overlay.slideDown(500).show();
    } else {
      $overlay.slideUp(500);
    }
    $overlayText.text(data);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

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
    }
  }

  function animateThrowCard (id, budRungi) {
    var posLeft = 168;
    var $el = $('#'+id);
    var new_left = posLeft - $el.position().left;
    $el.animate({top:'-86%', left:new_left, height:"80%"}, function() {
        $el.remove();
        id = budRungi ? 'budRungi' : id;
        $('.middle.table').append('<img id="card-1" class="tableCard" src="images/cards/'+id+'.svg" />');
        updateNextAvatar(1);
    });
  }

  function updateNextAvatar(num) {
    next = (num+1).toString();
    $(".avatar").css({'border': '2px solid white'});
    $(".avatar-"+next).css({'border': '5px solid gold'});
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addLogElement($el, options);
  }

  
  // Adds the thrown card on to the message list
  function addCard (data, options) {
    audio.play();
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
    $('.middle.table').append('<img id="card-'+perspective+'" class="tableCard" src="images/cards/'+data.message+'.svg" />');
    $('#card-'+perspective).animate(animateObj);
    updateNextAvatar(perspective);
  }

  // function addLogElement (el, options) {
  //   var $el = $(el);

  //   // Setup default options
  //   if (!options) {
  //     options = {};
  //   }
  //   if (typeof options.fade === 'undefined') {
  //     options.fade = true;
  //   }
  //   if (typeof options.prepend === 'undefined') {
  //     options.prepend = false;
  //   }

  //   // Apply options
  //   if (options.fade) {
  //     $el.hide().fadeIn(FADE_TIME);
  //   }
  //   if (options.prepend) {
  //     $logs.prepend($el);
  //   } else {
  //     $logs.append($el);
  //   }
  //   $logs[0].scrollTop = $logs[0].scrollHeight;
  // }

  function sendTrumpCard (id) {
    var message = id;
    if (message && connected) {
      socket.emit('trump card', message);
    }
  }

  function addTrumpElement (id) {
    choosingTrump = false;
    trumpCard = id;
    $trumpCard.append('<img id="'+id+'" src="images/cards/'+id+'.svg" class="trump"></img>');
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
    (data.hand).sort();
    for(var i in data.hand){
      $cards_in_hand.append($cards_in_hand.append("<div class='card-in-hand' id='"+data.hand[i]+"'><img src='images/cards/"+data.hand[i]+".svg' \/></div>"));
      cardsInHand.push(data.hand[i]);
    }
    updateSuitsInHand(cardsInHand);
  }

  function addPlayerElement (data) {
    for (i in data) {
      var element = $('.player'+(parseInt(i)+1));
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

  // $revealTrump.on("click", function() {
  //   socket.emit('reveal trump');  
  // });
  
  $requestTrump.on("click", function() {
    updateSuitsInHand(cardsInHand);
    var found = suitsInHand.find(function(element) {
        return element == currentRoundSuit;
    });

    if (!found && myTurn && currentRoundSuit) {
      socket.emit('request trump');
      
    } else {
      // log('you can\'t ask for trump right now', {
      //   prepend: false
      // });
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
    //addPlayerElement(playerSequence);
    playerPerspective = getPlayerPerspective(playerSequence);
    if (playerSequence.length == 4) {
      updateNextAvatar(playerPerspective.indexOf(playerSequence[0]));
    }
    addParticipantsMessage(data);
    if (playerNumber == 1 || playerNumber == 3){
      $requestTrump.hide();
    }
  });


  // Whenever the server emits 'card thrown', update the gameplay body
  socket.on('card thrown', function (data) {
    addCard(data);
  });

  socket.on('senior player', function (data) {
    // log((data.username +' is senior'));
    //$(".rounds").text(("Total Rounds: "+data.totalRounds));
    setTimeout(function() {$(".tableCard").remove();},2000);
    console.log("senior player from my perspective: " + playerPerspective.indexOf(data.username));
    updateNextAvatar(playerPerspective.indexOf(data.username));
  });
  
  socket.on('hands picked', function (data){
    $(".teamAHands").text((data.teamAHands));
    $(".teamBHands").text((data.teamBHands));
    $(".rounds").text(("Total Rounds: "+data.totalRounds));
  });

  socket.on("request trump", function(data) {
    // log((data.username + " has asked to reveal the Trump"));
    trumpAsked = true;
  });

  socket.on("reveal trump", function(data) {
    // log(("The trump is " + data.trumpCard));
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    // log(data.username + ' joined');
    addParticipantsMessage(data);
    playerSequence = data.playerSequence;
    playerPerspective = getPlayerPerspective(playerSequence);
    if (playerSequence.length == 4) {
      updateNextAvatar(playerPerspective.indexOf(playerSequence[0]));
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
  });

  // draw cards and ask him to choose trump
  socket.on('choose trump', function (data) {
    drawCardsInHand(data);
    // log('Choose the Trump');
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
    showOverlay(true, data.message);
  });

  socket.on('enable ui', function (data) {
    $document.on("click", ".card-in-hand" , function() {
      
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
    
            if ( found && $(this).attr('id').split(/(\d+)/)[0] == currentRoundSuit) {
              throwCard($(this).attr('id'));
              //$(this).remove();
              myTurn = false;
            } else if (!found){
    
              var budRungi = playerNumber == 1 && trumpRevealed == false ? true : false;

              throwCard($(this).attr('id'), budRungi);
              $(this).remove();
              myTurn = false;
            } else {
              // log('Please throw correct suit', {
              //   prepend: false
              // });
            }
          
          } else if (!currentRoundSuit && myTurn) {
            throwCard($(this).attr('id'));
            myTurn = false;
          } else {
            // log('Not your turn', {
            //   prepend: false
            // });
        }
      } else {
        $(this).addClass('co').animate({top:0});
        $(this).siblings().removeClass('co').animate({top: "40%"});
      }
    });


    $document.on("click", "img.trump" , function() {
      if (trumpAsked) {
        socket.emit('reveal trump');
        cardsInHand.push($(this).attr('id'));
        updateSuitsInHand(cardsInHand);
        $cards_in_hand.append("<div class='card-in-hand' id='"+$(this).attr('id')+"'><img src='images/cards/"+$(this).attr('id')+".svg' /></div>");
        
        $(this).remove();
        trumpRevealed = true;
      } else {
        // log('You can\'t reveal trump at this stage', {
        //   prepend: false
        // });
      }
    });

    showOverlay(false, data.message);
   });

});
