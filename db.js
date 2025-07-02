const mysql = require('mysql2/promise');

async function getConnection() {
  const connection = await mysql.createConnection({
    host: 'localhost',       // 또는 DB 서버 IP
    user: 'root',            // 너의 MySQL 계정
    password: '111111', // 비밀번호
    database: 'yolos',  
  })
  return connection;
}

module.exports = getConnection;
