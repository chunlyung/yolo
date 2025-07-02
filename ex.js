const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const port = 3000;

// DB 연결
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '111111', // 너가 쓰는 비번
  database: 'yolo'    // 사용할 DB 이름
});
db.connect();

// 미들웨어
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 제공 (signup.html 접근용)
app.use(express.static(__dirname));

// 회원가입 처리
app.post('/example', (req, res) => {
  const { username, password } = req.body;

  const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(sql, [username, password], (err, result) => {
    if (err) {
      console.error('DB 저장 오류:', err);
      return res.send('회원가입 실패. 이미 있는 아이디일 수 있어.');
    }
    res.send('회원가입 성공!'); // 또는 리다이렉트
  });
});

app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});
