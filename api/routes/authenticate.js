const router = require('express').Router();
const keys = require('../keys');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json()
const { Pool } = require('pg');

const pool = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

router.use(['/authenticate', '/api/authenticate'], jsonParser, async (req, res) => {
    const client = await pool.connect();
    let sql = `SELECT "playerID", "username" from players where username = '${req.body.username}' and password = '${req.body.password}'`
    const values = await client.query(sql)
    if (values.rowCount) {
        res.status(200)
        res.json({response: 'success', playerID: values.rows[0].playerID, username: values.rows[0].username })
    } else {
        res.status(401).jsonp({error: 'failed', reason: 'username or password incorrect'})
    }
    client.end();
});

module.exports = router;