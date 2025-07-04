require('dotenv').config(); 

const mysql = require('mysql2/promise');
 console.log('CONNECTING TO:',{
 host:process.env.DB_HOST,       // 또는 DB 서버 IP
    user:process.env.DB_USER,            // 너의 MySQL 계정
    password:process.env.DB_PASSWORD, // 비밀번호
    database:process.env.DB_NAME,
    port:process.env.DB_PORT  });

async function getConnection() {
  const connection = await mysql.createConnection({
    host:process.env.DB_HOST,       // 또는 DB 서버 IP
    user:process.env.DB_USER,            // 너의 MySQL 계정
    password:process.env.DB_PASSWORD, // 비밀번호
    database:process.env.DB_NAME,
    port:process.env.DB_PORT  
  })
  return connection;
}

module.exports = getConnection;
