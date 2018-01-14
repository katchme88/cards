exports.getSenior = function (data, trumpRevealed, trumpSuit, revealedInThis) {

    currentRoundCards = data.slice();
    trumpExist = 0;

    if (!revealedInThis) {
        
        if (!trumpRevealed) {
            currentSuit = data[0].charAt(0);
        } else {
            for (var i = 0; i < data.length; i++) {
                if (data[i].charAt(0) == trumpSuit) {
                    trumpExist = 1;
                    break;
                }
            }
            
            if (trumpExist) {
                currentSuit = trumpSuit;
            } else {
                currentSuit = data[0].charAt(0);
            }
        }

        for (var i = 0; i < data.length; i++) {
            if (data[i].charAt(0) != currentSuit) {
                data[i] = '0';
            }
        }
        console.log(currentRoundCards.length)
        console.log(currentRoundCards);
        seniorCard = data.sort()[data.length -1];
        return ([seniorCard, currentRoundCards.indexOf(seniorCard)+1]);
    } else {
        for (var i = 0; i < data.length; i++) {
            if (data[i].charAt(0) == trumpSuit) {
                trumpExist = 1;
                break;
            }
        }
        
        if (trumpExist) {
            currentSuit = trumpSuit;
        } else {
            currentSuit = data[0].charAt(0);
        }
    }
}
