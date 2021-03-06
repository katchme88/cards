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
    lastRoundObj: {},
    currentRoundSuit:'',
    roundsSinceLastWin: 0,
    playerSequence: [],
    lastRoundSenior: '',
    lastRoundSeniorCard: '',
    highestBet: 7,
    highestBettor: '',
    moodaCalled: false,
    moodaStatus: [],
    moodaAccepted: false,
    winningTeam: '',
    winningTeamScore: 0   
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

const searchForUserRoom = (username) => {
    for (let roomID in usersByRoom){
        if (username in usersByRoom[roomID].usersCards){
            return roomID
        } else {
            return false
        }
    }
}

module.exports = {
    addUser: (socket, username) => {
        let roomID = searchForUserRoom(username)
        if (roomID) {
            return roomID
        }
        roomID = getRoomID();
        usersByRoom[roomID]['users'][socket.id] = socket;
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