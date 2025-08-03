require('dotenv').config();
const mysql = require('mysql2/promise');

console.log('CONNECTING TO:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

async function getConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      timezone: '+09:00'
    });

    // 🔴 여기 추가: 연결 끊김 자동 감지 및 재연결 시도
    connection.on('error', async (err) => {
      console.error('MySQL 연결 오류 발생:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('🔁 DB 연결 끊김 -> 재연결 시도');
        await getConnection(); // 재연결 시도
      } else {
        throw err;
      }
    });

    return connection;
  } catch (err) {
    console.error('❌ DB 연결 실패:', err);
    throw err;
  }
}

module.exports = getConnection;