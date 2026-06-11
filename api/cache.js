const ROOM_CODE_MIN = 100000;
const ROOM_CODE_MAX = 999999;
const ROOM_CODE_SPACE = ROOM_CODE_MAX - ROOM_CODE_MIN + 1;
const RANDOM_ROOM_CODE_ATTEMPTS = 64;
const ROOM_TYPE_PRIVATE = 'private';
const ROOM_TYPE_QUICK_PLAY = 'quick_play';

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
    trumpRequested: false,
    moodaStatus: [],
    moodaAccepted: false,
    winningTeam: '',
    winningTeamScore: 0   
}

const deepCopy = (e) => {
    return JSON.parse(JSON.stringify(e));
}

const randomRoomCode = () => {
    return String(Math.floor(Math.random() * ROOM_CODE_SPACE) + ROOM_CODE_MIN);
}

const findAvailableRoomCode = () => {
    // Fast path: try random room codes first.
    for (let i = 0; i < RANDOM_ROOM_CODE_ATTEMPTS; i++) {
        const code = randomRoomCode();
        if (!usersByRoom[code]) return code;
    }

    // Fallback: deterministic scan guarantees a code if one exists.
    for (let code = ROOM_CODE_MIN; code <= ROOM_CODE_MAX; code++) {
        const key = String(code);
        if (!usersByRoom[key]) return key;
    }

    throw new Error('No room codes available');
}

const createRoom = (roomType = ROOM_TYPE_PRIVATE) => {
    let deck = require('./gameplay/deck.js').cards();
    let newRoomID = findAvailableRoomCode();
    usersByRoom[newRoomID] = Object.assign({users: {}, totalUsers: 0, deck: deck, roomType: roomType}, deepCopy(gameObjTemplate));
    return newRoomID;
}

const getRoomID = () => {
    for (let roomID in usersByRoom){
        if (usersByRoom[roomID].roomType === ROOM_TYPE_QUICK_PLAY && usersByRoom[roomID].totalUsers < 4){
            return roomID;
        }
    }
    return createRoom(ROOM_TYPE_QUICK_PLAY);
}

const searchForUserRoom = (username, roomType = null) => {
    for (let roomID in usersByRoom){
        if (roomType && usersByRoom[roomID].roomType !== roomType) {
            continue;
        }
        if (username in usersByRoom[roomID].usersCards){
            return roomID
        }
    }
    return false
}

module.exports = {
    createRoom: () => {
        return createRoom(ROOM_TYPE_PRIVATE);
    },
    addUser: (socket, username, requestedRoomID = null) => {
        if (requestedRoomID) {
            if (!usersByRoom[requestedRoomID]) {
                return null;
            }
            usersByRoom[requestedRoomID]['users'][socket.id] = socket;
            return requestedRoomID;
        }

        let roomID = searchForUserRoom(username, ROOM_TYPE_QUICK_PLAY)
        if (roomID) {
            usersByRoom[roomID]['users'][socket.id] = socket;
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
    },
    roomExists: (roomID) => {
        return !!usersByRoom[roomID];
    }
}