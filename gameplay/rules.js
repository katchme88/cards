exports.getSenior = function (data, trumpRevealed, trumpSuit, revealedInThis) {

    currentRoundCards = data.slice();
    trumpExist = 0;
       
    if (!trumpRevealed) {
        // If trump is not yet revealed the first card stays the current suit
        currentSuit = data[0].charAt(0);
    } else {
        //if trum is revealed  check for the trump suit in the current round
        for (var i = 0; i < data.length; i++) {
            if (data[i].charAt(0) == trumpSuit) {
                trumpExist = 1;
                break;
            }
        }
        
        if (trumpExist && !revealedInThis) {
            // If trump exist but not revealed in this set trump as the current suit
            currentSuit = trumpSuit;
        } else if (trumpExist && revealedInThis) {
            // If trump exist and also revealed in this then neglect prior cards
            currentSuit = trumpSuit;
            for (var i = 0; i < revealedInThis; i++) {
                data[i] = '0';
            }
        }
        else {
            // If trump rnot exist but is revealed then treat normally
            currentSuit = data[0].charAt(0);
        }
    }

    // set all cards to zero which do not match the current suit
    for (var i = 0; i < data.length; i++) {
        if (data[i].charAt(0) != currentSuit) {
            data[i] = '0';
        }
    }
    console.log(currentRoundCards);
    seniorCard = data.sort()[data.length -1];
    return ([seniorCard, currentRoundCards.indexOf(seniorCard)+1]);
}

exports.getWinner = function (seniorIndex, roundsSinceLastWin, revealedInThis) {
    if (seniorIndex == 1 && roundsSinceLastWin > 0 && revealedInThis < 1) {
        return (1);
    }
    return (0);
}