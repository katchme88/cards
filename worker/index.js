const redis = require("redis");
const keys = require("./keys");
const { Client } = require('pg');

const ERR = 'ERROR' 
const INFO = 'INFO'

const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});

const addToDatabase = async (data) => {
	let status = true;
	const pgClient = new Client();
	await pgClient.connect();
    const gameObject = data
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
		log(ERR, `${err.detail} in ${err.table}`)
    }
    
	await pgClient.end();
	return status
}


const waitForPush = () => {
    redisClient.blpop(['queue', 0], async (error, item) => {
		const data = JSON.parse(item[1])
		let status;
		log(INFO, `${data.roomID} ${data.gameID}`)
		
		try {
			status = await addToDatabase(data);
		} catch {
			log(ERR, 'data error')
			await redisClient.rpush('errors', JSON.stringify(data));
		}
		if (!status) {
			await redisClient.rpush('errors', JSON.stringify(data));
		}
        waitForPush();
    });
}

const log = (type, data) =>{
	console.log(new Date(Date.now()).toISOString().replace(/T/, ' ').replace(/\..+/, ''), type, data)
}

waitForPush()