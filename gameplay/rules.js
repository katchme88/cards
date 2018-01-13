exports.getSenior = function (data, trumpRevealed, trumpSuit, revealedInThis) {
  
  var turn = JSON.parse(data);
  var thisGamePlay =  JSON.parse(data);
  
  console.log(('currentsuit : '+currentSuit));

  if (!trumpRevealed) {

    if (!trumpRevealed) {
        var currentSuit = Object.keys(turn)[0].charAt(0);
        var x = (Object.keys(turn)[1].charAt(0) == currentSuit);
        var y = (Object.keys(turn)[2].charAt(0) == currentSuit);
        var z = (Object.keys(turn)[3].charAt(0) == currentSuit);
    }

    if (trumpRevealed) {

        for (var i=0; i < Object.keys(turn).lenght; i++) {
            if (Object.keys(turn)[i].charAt(0) == trumpSuit) {
                var currentSuit = Object.keys(turn)[i].charAt(0);
            }
        }

        
        var x = (Object.keys(turn)[1].charAt(0) == currentSuit);
        var y = (Object.keys(turn)[2].charAt(0) == currentSuit);
        var z = (Object.keys(turn)[3].charAt(0) == currentSuit);
    }

    if (x && y && z) {
      seniorCard = Object.keys(turn).sort()[3]
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (x && y && !z) {
      console.log('z deleted');
      delete turn[Object.keys(turn)[3]];
      seniorCard = Object.keys(turn).sort()[2];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (x && !y && z) {
      console.log('y deleted');
      delete turn[Object.keys(turn)[2]];
      seniorCard = Object.keys(turn).sort()[2]
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (!x && y && z) {
      console.log('x deleted');
      delete turn[Object.keys(turn)[1]];
      seniorCard = Object.keys(turn).sort()[2];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (x && !y && !z) {
      console.log('yz deleted');
      delete turn[Object.keys(turn)[2]];
      delete turn[Object.keys(turn)[2]];
      seniorCard = Object.keys(turn).sort()[1];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];       
    }
    if (!x && !y && z) {
      console.log('xy deleted');
      delete turn[Object.keys(turn)[1]];
      delete turn[Object.keys(turn)[1]];
      console.log(turn);
      seniorCard = Object.keys(turn).sort()[1];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (!x && y && !z) {
      console.log('xz deleted');
      delete turn[Object.keys(turn)[1]];
      delete turn[Object.keys(turn)[2]];
      seniorCard = Object.keys(turn).sort()[1];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
    if (!x && !y && !z) {
      console.log('xyz deleted');
      seniorCard = Object.keys(turn)[0];
      senior = turn[seniorCard];
      seniorTurn = Object.keys(thisGamePlay).indexOf(seniorCard);
      return [senior,seniorCard,seniorTurn+1];
    }
  } 
}