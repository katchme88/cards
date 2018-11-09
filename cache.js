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

const createRoom = () => {
    let newRoomID = Math.floor(Math.random() * Math.floor(10));
    usersByRoom[newRoomID] = Object.assign({users: {}, totalUsers: 0}, gameObjTemplate);
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
        //++usersByRoom[roomID]['totalUsers'];
        //++usersByRoom[roomID]['numUsers'];
        console.log(usersByRoom);
        return roomID;
    },
    getGameCache: (roomID) => {
        return usersByRoom[roomID];
    },
    updateGameCache: (roomID, data) => {
        usersByRoom[roomID] = data;
    }
}