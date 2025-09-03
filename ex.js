const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const port = 3000;


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '111111', 
  database: 'yolo'    
});
db.connect();


app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname));


app.post('/example', (req, res) => {
  const { username, password } = req.body;

  const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(sql, [username, password], (err, result) => {
    if (err) {
      console.error('DB 저장 오류:', err);
      return res.send('회원가입 실패. 이미 있는 아이디일 수 있어.');
    }
    res.send('회원가입 성공!'); 
  });
});

app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});
