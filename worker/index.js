const redis = require("redis");
const keys = require("./keys");
const { Pool } = require('pg');

const pool = new Pool({
	user: keys.pgUser,
	host: keys.pgHost,
	database: keys.pgDatabase,
	password: keys.pgPassword,
	port: keys.pgPort
});

const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});

const addToDatabase = async (data) => {
	let status = true;
    const pgClient = await pool.connect();
    const gameObject = JSON.parse(data)
    const gameType = gameObject.moodaCalled ? "mooda": "bidding";
    const gameStatus = "ended";
    const start_dt = new Date(gameObject.start_dt).toISOString().replace(/T/, ' ').replace(/\..+/, '')
    const end_dt = new Date(gameObject.end_dt).toISOString().replace(/T/, ' ').replace(/\..+/, '')
    const gamesSQL = `INSERT INTO games ("gameID", "roomID", "gameType", "status", "start_dt", "end_dt", "trumpCard", "moodaSuit") VALUES ('${gameObject.gameID}', '${gameObject.roomID}', '${gameType}', '${gameStatus}', '${start_dt}', '${end_dt}', '${gameObject.trumpCard}', '${gameObject.moodaSuit}')`
    const betsSQL = `INSERT INTO bets ("gameID", "playerID", "bet") VALUES ('${gameObject.gameID}', '${gameObject.players.p1.playerID}', '${gameObject.players.p1.bet}'),('${gameObject.gameID}', '${gameObject.players.p2.playerID}', '${gameObject.players.p2.bet}'),('${gameObject.gameID}', '${gameObject.players.p3.playerID}', '${gameObject.players.p3.bet}'),('${gameObject.gameID}', '${gameObject.players.p4.playerID}', '${gameObject.players.p4.bet}')`
	const playersGamesSQL = `INSERT INTO players_games ("playerID", "gameID", "playerNum", "result", "score", "tricks")  VALUES 
			('${gameObject.players.p1.playerID}','${gameObject.gameID}','${gameObject.players.p1.playerNum}','${gameObject.players.p1.result}','${gameObject.players.p1.score}','${gameObject.players.p1.tricks}'),
			('${gameObject.players.p2.playerID}','${gameObject.gameID}','${gameObject.players.p2.playerNum}','${gameObject.players.p2.result}','${gameObject.players.p2.score}','${gameObject.players.p2.tricks}'),
			('${gameObject.players.p3.playerID}','${gameObject.gameID}','${gameObject.players.p3.playerNum}','${gameObject.players.p3.result}','${gameObject.players.p3.score}','${gameObject.players.p3.tricks}'),
			('${gameObject.players.p4.playerID}','${gameObject.gameID}','${gameObject.players.p4.playerNum}','${gameObject.players.p4.result}','${gameObject.players.p4.score}','${gameObject.players.p4.tricks}')` 
    try {
		await pgClient.query(gamesSQL);
		await pgClient.query(betsSQL);
		await pgClient.query(playersGamesSQL);
    } catch (err) {
		status = false
    }
    
	pgClient.end();
	return status
}


const waitForPush = () => {
    redisClient.blpop(['queue', 0], async (error, item) => {
		let status = await addToDatabase(item[1]);
		if (!status) {
			redisClient.rpush('errors', item[1]);
		}
        waitForPush();
    });
}

waitForPush()