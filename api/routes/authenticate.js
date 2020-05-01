const router = require('express').Router();
const keys = require('../keys');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json()
const { Client } = require('pg');
router.use(['/authenticate', '/api/authenticate'], jsonParser, async (req, res) => {
    const client = new Client()
    await client.connect()
    let sql = `SELECT "playerID", "username" from players where username = '${req.body.username}' and password = '${req.body.password}'`
    const values = await client.query(sql)
    if (values.rowCount) {
        res.status(200)
        res.json({response: 'success', playerID: values.rows[0].playerID, username: values.rows[0].username })
    } else {
        res.status(401).jsonp({error: 'failed', reason: 'username or password incorrect'})
    }
    await client.end();
});

module.exports = router;