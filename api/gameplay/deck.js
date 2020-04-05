var shuffle = require('mess');

// function shuffle(card, n) {       
//     var test = card.slice()
//     for (var i = 0; i < n; i++) { 
//         // Random for remaining positions. 
//         var r = i + Math.floor(Math.random() * Math.floor(52 - i))
        
//         //swapping the elements 
//         var temp = test[r]; 
//         test[r] = test[i]; 
//         test[i] = temp; 
//     } 
//     return(test)
// } 

var deck = {
    cards: function() {
        var myCards = [ 'C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14',
                        'D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14',
                        'H02','H03','H04','H05','H06','H07','H08','H09','H10','H11','H12','H13','H14',
                        'S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13','S14' 
                    ];
        // var cards = shuffle(myCards, 52)
        return deck.distribute(shuffle(myCards, 52));
    },

    distribute: function (arr) {
        var shuffled_deck = [];
        var pcards = {p1:[],p2:[],p3:[],p4:[]};
        var h = {0:5,1:4,2:4};
        for (var k in h) {
            for (var i=0; i<4; i++) {
                for (var j=0; j<h[k]; j++) { 
                    pcards['p'+(i+1)].push(arr.shift());
                }
            }
        }
        // pcards.p1 = arr.splice(0,13)
        // pcards.p2 = arr.splice(0,13)
        // pcards.p3 = arr.splice(0,13)
        // pcards.p4 = arr.splice(0,13)

        shuffled_deck = (pcards.p1).concat(pcards.p2).concat(pcards.p3).concat(pcards.p4);
        return shuffled_deck;
    }
}

module.exports = deck;