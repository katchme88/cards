let uuid = require('uuid/v1');

let usersByRoom = {};
let gameObjTemplate = {
    numUsers: 0,
    usersCards: {},
    turn: 0,
    totalRounds: 0,
    players: {},
    teamA: [],
    teamB: [],
    teamAHands: 0,
    teamBHands: 0,
    trumpRevealed: 0,
    revealedInThis: 0,
    trumpCard: '',
    currentRoundCards: [],
    currentRoundObj: {},
    currentRoundSuit:'',
    roundsSinceLastWin: 0,
    playerSequence: []
}

const deepCopy = (e) => {
    return JSON.parse(JSON.stringify(e));
}

const createRoom = () => {
    let deck = require('./gameplay/deck.js').cards();
    let newRoomID = uuid();
    usersByRoom[newRoomID] = Object.assign({users: {}, totalUsers: 0, deck: deck}, deepCopy(gameObjTemplate));
    return newRoomID;
}

const getRoomID = () => {
    for (let roomID in usersByRoom){
        if (usersByRoom[roomID].totalUsers < 4){
            return roomID;
        }
    }
    return createRoom();
}

module.exports = {
    addUser: (user) => {
        let roomID = getRoomID();
        usersByRoom[roomID]['users'][user.id] = user;
        //console.log(usersByRoom);
        return roomID;
    },
    getGameCache: (roomID) => {
        return usersByRoom[roomID];
    },
    updateGameCache: (roomID, data) => {
        usersByRoom[roomID] = data;
    },
    deleteRoom: (roomID) => {
        delete usersByRoom[roomID];
        return true
    }
}