$(function() {
    var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms
    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];
    var CIH_TOPS = {
        'cih-0': '58%',
        'cih-1': '53%',
        'cih-2': '49%',
        'cih-3': '46%',
        'cih-4': '43%',
        'cih-5': '42%',
        'cih-6': '42%',
        'cih-7': '43%',
        'cih-8': '46%',
        'cih-9': '48%',
        'cih-10': '52%',
        'cih-11': '56%',
        'cih-12': '62.5%'
    };

    // Initialize variables
    var $window = $(window);
    var $document = $(document);
    var $usernameInput = $('.usernameInput'); // Input for username
    var $inputMessage = $('.inputMessage'); // Input message input box
    //var $revealTrump = $('.revealTrump');
    var $requestTrump = $('.requestTrump');
    var $trumpCard = $('.trumpCard');
    var $moodaSuit = $('.moodaSuit');
    var $partnerCardsOverlay = $(".partnerCardsOverlay");
    var $loginPage = $('.login.page'); // The login page
    var $chatPage = $('.chat.page'); // The chatroom page
    var $overlay = $('#overlay');
    var $moodaBtnOverlay = $('.moodaBtnOverlay');

    var $cards_in_hand = $('.cards-in-hand');
    var choosingTrump = false;
    var trumpCard = "";
    var currentRoundSuit;
    var trumpAsked = false;
	var trumpRevealed = false;
	var moodaCalled = false;

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

    var playerSequence = [];
    var playerPerspective = [];
    var turn = 0;
    var youRequestedTrump = false;
    var highestBet = 0;

    var socket = io();

    function addParticipantsMessage(data) {
        var message = '';
        if (data.numUsers === 1) {
            message += "there's 1 participant";
        } else {
            message += "there are " + data.numUsers + " participants";
        }
    }

    function showOverlay(data, timeout = 4000) {
        $('.overlay').html('<p>' + data + '</p>').fadeIn(1000);
        setTimeout(function() {
            $('.overlay').fadeOut(500);
        }, timeout);
    }

    function hideOverlay() {
        $('.overlay').hide()
    }

    // Sets the client's username
    function setUsername() {
        username = cleanInput($usernameInput.val().trim());
        username = username.toUpperCase();
        // If the username is valid
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();
            $usernameInput.blur();
            // Tell the server your username
            socket.emit('add user', username);
        }
    }

    function throwCard(id, budRungi) {
        var message = id;
        if (message && connected) {
            // tell server to execute 'card thrown' and send along one parameter
            cardsInHand.splice(cardsInHand.indexOf(message), 1);
            updateSuitsInHand(cardsInHand);

            //throw a budrungi if budRungi is true
            message = budRungi ? 'budRungi' : message;
            animateThrowCard(id, budRungi);
            socket.emit('card thrown', message);
            turn++;
            bounceAvatar(0);
        }
    }

    function animateThrowCard(id, budRungi) {
        var posLeft = ($('.middle').css('width').split('px')[0] - $('.card-in-hand').css('width').split('px')[0]) / 2;
        var $el = $('#' + id);
        var new_left = posLeft - $el.position().left;
        $el.animate({
            top: '-86%',
            left: new_left,
            height: "80%"
        }, function() {
            $el.remove();
            id = budRungi ? 'budRungi' : id;
            $('.middle.table').append('<img id="card-1" class="tableCard" src="images/cards/' + id + '.png" />');
            updateNextAvatar(1);
        });
    }

    function updateNextAvatar(num) {
        var next = (num + 1).toString();
        $(".avatar > img").css({
            'border': '0px solid white'
        });
        $(".avatar-" + next + " > img").css({
            'border': '5px solid gold'
        });
        if (num === 0) {
            bounceAvatar(1);
        }
    }

    function bounceAvatar(bool) {
        var $el = $(".avatar-1");
        if (!bool) {
            $el.finish();
            return;
        }
        $el.effect("shake", {
            times: 100,
            direction: 'up'
        }, 100000);
    }

    function indicateTrumpCaller(num) {
        for (var i = 1; i <= 4; i++) {
            $(".avatar-" + i).removeClass('trumpCaller');
        }
        var next = (num + 1).toString();
        $(".avatar-" + next).addClass('trumpCaller');
    }

    function updatePlayerName(perspective) {
        for (var i = 0; i < perspective.length; i++) {
            $(".name-" + (i + 1)).html("<center><b>" + perspective[i] + "</b></center>");
        }
    }

    // Log a message
    function log(message, options) {
        var $el = $('<li>').addClass('log').text(message);
        addLogElement($el, options);
    }


    // Adds the thrown card on to the message list
    function addCard(data, options) {
        audio_throw.play();
        var perspective = playerPerspective.indexOf(data.username) + 1;
        var animateObj = {};
        var avatarNum = 0;
        switch (perspective) {
            case 2:
                animateObj = {
                    right: '32%'
                };
                break;
            case 3:
                animateObj = {
                    bottom: '55%'
                };
                break;
            case 4:
                animateObj = {
                    right: '56%'
                };
                break;
            default:
                animateObj = {};
        }
        $('.middle.table').append('<img id="card-' + perspective + '" class="tableCard" src="images/cards/' + data.message + '.png" />');
        $('#card-' + perspective).animate(animateObj);
        updateNextAvatar(perspective);
    }

    function sendTrumpCard(id) {
        var message = id;
        if (message && connected) {
            socket.emit('trump card', message);
        }
    }

    function addTrumpElement(id) {
        choosingTrump = false;
        $requestTrump.hide();
        $moodaSuit.hide();
        $trumpCard.html('<img id="' + id + '" src="images/cards/' + id + '.png"></img>');
        $trumpCard.show();
    }

    function addRequestTrumpElement(id) {
        $trumpCard.hide();
        $moodaSuit.hide();
        $requestTrump.html('<img id="' + id + '" src="images/cards/' + id + '.png"></img>');
        $requestTrump.show();
    }

    function updateSuitsInHand(cardsInHand) {
        var arr = [];
        suitsInHand = [];
        for (var i in cardsInHand) {
            arr.push(cardsInHand[i].split(/(\d+)/)[0]);
        }
        $.each(arr, function(i, el) {
            if ($.inArray(el, suitsInHand) === -1) suitsInHand.push(el);
        });
    }

    function arrangeCards(data) {
        var cards = data.slice();
        let diamonds = []
        let clubs = []
        let hearts = []
        let spades = []
        for (let i in cards) {
            let x = cards[i].split(/(\d+)/)[0]
            if (x == 'C') {
                clubs.push(cards[i])
            }
            if (x == 'D') {
                diamonds.push(cards[i])
            }
            if (x == 'S') {
                spades.push(cards[i])
            }
            if (x == 'H') {
                hearts.push(cards[i])
            }
        }
        return clubs.concat(diamonds).concat(spades).concat(hearts)
    }

    // Prevents input from having injected markup
    function cleanInput(input) {
        return $('<div/>').text(input).html();
    }

    // draw cards on screen
    function drawCardsInHand(data) {
        if (data.redeal) {
            cardsInHand = [];
        }
        var x = cardsInHand.concat(data.hand);
        x.sort();
        cardsInHand = arrangeCards(x);
        $('.card-in-hand').remove();
        for (var i in cardsInHand) {
            $cards_in_hand.append("<div class='card-in-hand cih-" + i + "' id='" + cardsInHand[i] + "'><img src='images/cards/" + cardsInHand[i] + ".png' \/></div>");

        }
        console.log(cardsInHand);
        updateSuitsInHand(cardsInHand);
    }

    function drawpartnerCards(data) {
        var $partnerCards = $(".partnerCards");
        var partnerCards = data.partnerCards;
        partnerCards.sort();
        partnerCards = arrangeCards(partnerCards);
        $('.pcih').remove();
        for (var i in partnerCards) {
            $partnerCards.append("<div class='pcih'><img src='images/cards/" + partnerCards[i] + ".png' \/></div>");
        }
        $partnerCardsOverlay.show();
    }

    function addPlayerElement(data, scores) {
        var player1 = data[0] || '';
        var player2 = data[1] || '';
        var player3 = data[2] || '';
        var player4 = data[3] || '';
        $("#teamAnames").text(`${player1} ${player3}`);
        $("#teamBnames").text(`${player2} ${player4}`);

        if (!(typeof scores === 'undefined')) {
            console.log(scores)
            $('#teamAscore').text(scores.teamAscore);
            $('#teamBscore').text(scores.teamBscore);
            $('#teamAwins').text(scores.teamAwins);
            $('#teamBwins').text(scores.teamBwins);
        }
    }

    function getPlayerPerspective(data) {
        var perspective = data.slice();
        var mySeq = perspective.indexOf(username);
        for (var i = 0; i < mySeq; i++) {
            perspective.push(perspective.shift());
        }
        return perspective;
    }

    function clearTable(username) {
        setTimeout(function() {
            $(".tableCard").remove();
            updateNextAvatar(playerPerspective.indexOf(username));
        }, 2000);
    }

    function vibrateCard(el) {
        el.effect("shake", {
            "distance": 5
        });
	}
	
	function hideBetBubbles(bool, data) {
		for (var num = 1; num <= 4; num++) {
            $(".betBubble-" + num).hide();
		} 
	}


    // Keyboard events
    $window.keydown(function(event) {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // When the client hits ENTER on their keyboard
        if (event.which === 13) {
            if (username) {
                sendMessage();
            } else {
                setUsername();
            }
        }
    });

    $inputMessage.on('input', function() {

    });

    // Click events

    // Focus input when clicking anywhere on login page
    $loginPage.click(function() {
        $currentInput.focus();
    });

    // Focus input when clicking on the message input's border
    $inputMessage.click(function() {
        $inputMessage.focus();
    });

    $("#send-msg").click(function() {
        $(".chatBox").show();
        $("#chat-msg").focus();
    });

    $("#send-btn").click(sendMessage());

    function sendMessage() {
        var msg = $("#chat-msg").val();

        if (msg.toLowerCase() === 'c:') {
            $("#chat-msg").val('');
            $("#chat-msg").blur();
            $(".chatBox").fadeOut();
            $('.controller').show();
            return;
        }

        socket.emit('message', {
            username: username,
            message: msg,
        });
        $("#chat-msg").val('');
        $("#chat-msg").blur();
        $(".chatBox").fadeOut();

    }

    $('.moodaBtn').on('click', function() {
        var moodaSuit = $(this).attr('id')
        socket.emit('mooda', {
            moodaSuit: moodaSuit
        })
        $moodaBtnOverlay.hide();
    });

    $('.close').on('click', function() {
        $('.close').parent().hide();
    });

    $('#btn_close').on('click', function() {
        $('.controller').hide();
    });
    $('#btn_next').on('click', function() {
        socket.emit('command', {
            command: 'next'
        });
    });
    $('#btn_redeal').on('click', function() {
        socket.emit('command', {
            command: 'redeal'
        });
    });
    $('#btn_reset').on('click', function() {
        socket.emit('command', {
            command: 'reset'
        });
    });
    $('#btn_team').on('click', function() {
        socket.emit('command', {
            command: 'team'
        });
    });

    $('#btn_bet_pass').on('click', function() {
        socket.emit('bet', {
            bet: 'pass',
            username: username
        });
        $('.betbox').hide();
    });
    $('#btn_bet_8').on('click', function() {
        if (8 > highestBet) {
            socket.emit('bet', {
                bet: 8,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });
    $('#btn_bet_9').on('click', function() {
        if (9 > highestBet) {
            socket.emit('bet', {
                bet: 9,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });
    $('#btn_bet_10').on('click', function() {
        if (10 > highestBet) {
            socket.emit('bet', {
                bet: 10,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });
    $('#btn_bet_11').on('click', function() {
        if (11 > highestBet) {
            socket.emit('bet', {
                bet: 11,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });
    $('#btn_bet_12').on('click', function() {
        if (12 > highestBet) {
            socket.emit('bet', {
                bet: 12,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });
    $('#btn_bet_13').on('click', function() {
        if (13 > highestBet) {
            socket.emit('bet', {
                bet: 13,
                username: username
            });
            $('.betbox').hide();
        } else {
            showOverlay(`Current highest bet is ${highestBet}. Choose a different bet or pass.`);
        }
    });

    $('#acceptmooda').on('click', function() {
        socket.emit('accepted');
        $partnerCardsOverlay.hide();
    });

    $('#rejectmooda').on('click', function() {
        socket.emit('rejected');
        $partnerCardsOverlay.hide();
    });

    //#########################################################################################
    // Socket events
    //#########################################################################################


    // Whenever the server emits 'login', log the login message
    socket.on('login', function(data) {
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
    });


    // Whenever the server emits 'card thrown', update the gameplay body
    socket.on('card thrown', function(data) {
        addCard(data);
        turn = data.turn;
    });

    socket.on('senior player', function(data) {
        clearTable(data.username);
    });

    socket.on('hands picked', function(data) {
        $("#teamAHands").text(data.teamAHands);
        $("#teamBHands").text(data.teamBHands);
        var winner = playerSequence.indexOf(data.username) + 1;
        var msg = '';
        if (playerNumber === winner || playerNumber === winner + 2 || playerNumber === winner - 2) {
            msg = 'Your team picked ' + data.handsPicked + ' hands';
        } else {
            msg = 'Your opponents picked ' + data.handsPicked + ' hands';
        }
        showOverlay(msg);
        clearTable(data.username);
    });

    socket.on('winner announcement', function(data) {
        showOverlay(data.message);
        $('#teamAhands').text(data.teamAHands);
        $('#teamBhands').text(data.teamBHands);
        $('#teamAscore').text(data.teamAscore);
        $('#teamBscore').text(data.teamBscore);
        $('#teamAwins').text(data.teamAwins);
        $('#teamBwins').text(data.teamBwins);
    });

    socket.on("request trump", function(data) {
        trumpAsked = true;
        $('.trumpCard > img').trigger("click");
        showOverlay(data.username + ' opened the trump');
    });

    socket.on("reveal trump", function(data) {
        // log(("The trump is " + data.trumpCard));
        $requestTrump.html('<img src="images/cards/' + data.trumpCard + '.png"></img>');
        trumpCard = data.trumpCard;
        trumpRevealed = true;
    });

    socket.on("trump card", function(data) {
		$moodaSuit.hide()
		addTrumpElement(data.data);
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', function(data) {
        audio_ding.play();
        addParticipantsMessage(data);
        playerSequence = data.playerSequence;
        playerPerspective = getPlayerPerspective(playerSequence);
        updatePlayerName(playerPerspective);
        if (playerSequence.length == 4 && !data.reConnected) {
            updateNextAvatar(playerPerspective.indexOf(playerSequence[0]));
            indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
        }
        addPlayerElement(playerSequence);
        if (data.reConnected) {
            hideOverlay()
            showOverlay(`${data.username} is back online`)
        }
    });

    // draw the received cards on screen
    socket.on('deal', function(data) {
        console.log('deal:', data)
        drawCardsInHand(data);
        var firstPlayerBetBubble = playerPerspective.indexOf(playerSequence[0]) + 1
        for (var num = 1; num <= 4; num++) {
            if (num != firstPlayerBetBubble) {
                $(".betBubble-" + num).hide();
            }
        }
    });

    // Your turn
    socket.on('your turn', function(data) {
        myTurn = true;
        currentRoundSuit = data.currentRoundSuit;
		updateNextAvatar(0);
		if (!data.moodaCalled && data.totalRounds == 0) {
            $('.moodaicon').on('click', function () {
                $moodaBtnOverlay.show();
            });
		}
        
    });

    // draw cards and ask him to choose trump
    socket.on('choose trump', function(data) {

        // if (data.redeal) {
        //   indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
        //   clearTable(playerSequence[0]);
        // }
        // drawCardsInHand(data);
        bounceAvatar(1);
        showOverlay('You can click to choose the trump when all players have joined');
        choosingTrump = true;
    });

    socket.on('choose bet', function(data) {
        highestBet = data.highestBet
        $('.betbox').show();
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', function(data) {
        showOverlay(data.message, data.timeout);
        // setTimeout(function() { socket.emit('disconnect');}, 3000);
    });

    socket.on('disconnect', function() {
        showOverlay('You have been disconnected');
        setTimeout(function() {
            location.reload(true);
        }, 3000);
    });

    socket.on('reconnect', function() {
        // log('you have been reconnected');
        if (username) {
            location.reload(true);
        }
    });

    socket.on('reconnect_error', function() {
        // log('attempt to reconnect has failed');
    });

    socket.on('disable ui', function(data) {
        $document.off('click');
        //showOverlay(data.message);
    });

    socket.on('room full', function() {
        showOverlay('Room full. A game is in progress');
        setTimeout(function() {
            location.reload(true);
        }, 5000);
        return;
    });

    socket.on('trump setted', function(data) {
        showOverlay(playerSequence[0] + ' has chosen the trump');
        addRequestTrumpElement('budRungi');
    });

    socket.on('enable ui', function(data) {
        $document.on("click", ".card-in-hand", function() {
            updateSuitsInHand(cardsInHand);
            var found = suitsInHand.find(function(element) {
                return element == currentRoundSuit;
            });

            if (myTurn && found && $(this).attr('id')[0] != currentRoundSuit) {
                vibrateCard($(this));
                showOverlay('Throw correct suit');
                return;
            }

            if (myTurn && currentRoundSuit && !found && $(this).attr('id')[0] != currentRoundSuit && (playerNumber == 2 || playerNumber == 4) && !trumpRevealed) {
                vibrateCard($(this));
                showOverlay('Click on the trump card to open it');
                return;
            }

            if (trumpRevealed && youRequestedTrump) {
                updateSuitsInHand(cardsInHand);
                var found = suitsInHand.find(function(element) {
                    return element == trumpCard[0];
                });
                if (found && $(this).attr('id')[0] != trumpCard[0]) {
                    vibrateCard($(this));
                    showOverlay('You have to throw trump');
                    return;
                }
                youRequestedTrump = false;
            }

            if (!choosingTrump && !myTurn) {
                vibrateCard($(this));
                showOverlay('Wait for your turn');
                return;
            }

            if ($(this).hasClass('co')) {
                $moodaBtnOverlay.hide();
                if (choosingTrump) {
                    sendTrumpCard($(this).attr('id'));
                    // addTrumpElement($(this).attr('id'));
                    cardsInHand.splice(cardsInHand.indexOf($(this).attr('id')), 1);
                    updateSuitsInHand(cardsInHand);
                    $(this).remove();
                } else if (currentRoundSuit && myTurn) {
                    updateSuitsInHand(cardsInHand);
                    var found = suitsInHand.find(function(element) {
                        return element == currentRoundSuit;
                    });
                    if (found && $(this).attr('id')[0] == currentRoundSuit) {
                        throwCard($(this).attr('id'));
                        myTurn = false;
                    } else if (!found) {
                        var budRungi = playerNumber == 1 && trumpRevealed == false ? true : false;
                        throwCard($(this).attr('id'), budRungi);
                        //$(this).remove();
                        myTurn = false;
                    } else {}

                } else if (!currentRoundSuit && myTurn) {
                    throwCard($(this).attr('id'));
                    myTurn = false;
                } else {
                    showOverlay('Wait for your turn');
                }
            } else {
                $(this).addClass('co').animate({
                    top: 0
                });
                var str = $(this).siblings('.co').attr('class');
                if (str) {
                    $(this).siblings('.co').animate({
                        top: CIH_TOPS[str.split(' ')[1]]
                    });
                    $(this).siblings('.co').removeClass('co');
                }
            }
        });

        $document.on("click", ".trumpCard > img", function() {
            if (trumpAsked) {
                socket.emit('reveal trump');
                cardsInHand.push($(this).attr('id'));
                updateSuitsInHand(cardsInHand);
                $cards_in_hand.append("<div class='card-in-hand' id='" + $(this).attr('id') + "'><img src='images/cards/" + $(this).attr('id') + ".png' /></div>");
                $(this).remove();
                trumpRevealed = true;
            } else {
                vibrateCard($(this));
                showOverlay('you can\'t open trump card at this stage');
            }
        });

        $document.on("click", ".requestTrump > img", function() {
            updateSuitsInHand(cardsInHand);
            var found = suitsInHand.find(function(element) {
                return element == currentRoundSuit;
            });
            if (!found && myTurn && currentRoundSuit && playerNumber != 3) {
                socket.emit('request trump');
                youRequestedTrump = true;
            } else if (playerNumber === 3) {
                vibrateCard($(this));
                showOverlay('your partner is the trump caller');
            } else {
                vibrateCard($(this));
                showOverlay('you can\'t request for trump card at this stage');
            }
        });
    });

    socket.on('redeal', function(data) {
        choosingTrump = false;
        trumpCard = "";
        currentRoundSuit;
        trumpAsked = false;
        trumpRevealed = false;
        myTurn = false;
        suitsInHand = [];
        cardsInHand = [];
        turn = 0;
        youRequestedTrump = false;
        playerSequence = data.playerSequence;
        playerNumber = data.playerNumber;
        playerPerspective = getPlayerPerspective(playerSequence);
        // x = {
        //     playerSequence: playerSequence,
        //     playerNumber: playerNumber,
        //     playerPerspective: playerPerspective
        // };
        // // console.log(x);
        indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
        bounceAvatar(0);
        clearTable(playerSequence[0]);
        addPlayerElement(playerSequence, data);
        updatePlayerName(playerPerspective);
        $(".tricks").text("0");
        $trumpCard.children().remove()
        $trumoCard.hide();
        $requestTrump.hide();
        $moodaSuit.hide();
    });

    socket.on('new sequence', function(data) {
        playerSequence = data.playerSequence;
        playerNumber = data.playerNumber;
        playerPerspective = getPlayerPerspective(playerSequence);
        indicateTrumpCaller(playerPerspective.indexOf(playerSequence[0]));
        bounceAvatar(0);
        addPlayerElement(playerSequence, data);
        updatePlayerName(playerPerspective);
    });

    socket.on('mooda', function(data) {
		myTurn = false;
		trumpRevealed = true;
        $trumpCard.children().remove()
        $trumoCard.hide();
		$requestTrump.hide();
		hideBetBubbles();
		clearTable(socket.username);
		var num = playerPerspective.indexOf(data.username) + 1;
        $(".betBubble-" + num).html('<p>Mooda</p>');
        $(".betBubble-" + num).show();
        $moodaSuit.html('<img src="images/cards/' + data.moodaSuit + '.jpg"></img>');
        $moodaSuit.show()
    });

    socket.on('share cards', function(data) {
        drawpartnerCards(data);
    });

    socket.on('reset', function() {
        setTimeout(function() {
            showOverlay('game will reset');
            location.reload(true);
        }, 3000);
    });

    socket.on('message', function(data) {
        var num = playerPerspective.indexOf(data.username) + 1;
        $(".chatBubble-" + num).html('<p>' + data.message + '</p>');
        $(".chatBubble-" + num).show();
        setTimeout(function() {
            $(".chatBubble-" + num).fadeOut();
        }, 5000);
    });

    socket.on('bet', function(data) {
        var num = playerPerspective.indexOf(data.username) + 1;
        $(".betBubble-" + num).html('<p>' + data.bet + '</p>');
        $(".betBubble-" + num).show();
	});
	
	socket.on('accepted', function(data) {
		var num = playerPerspective.indexOf(data.username) + 1;
		$(".betBubble-" + num).html('<p>Accepted</p>');
		$(".betBubble-" + num).show();
	});

	socket.on('rejected', function(data) {
		var num = playerPerspective.indexOf(data.username) + 1;
		$(".betBubble-" + num).html('<p>Rejected</p>');
		$(".betBubble-" + num).show();
	});
});