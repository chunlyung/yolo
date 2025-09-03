require('dotenv').config(); 

const mysql = require('mysql2/promise');
 console.log('CONNECTING TO:',{
 host:process.env.DB_HOST,      
    user:process.env.DB_USER,            
    password:process.env.DB_PASSWORD, 
    database:process.env.DB_NAME,
    port:process.env.DB_PORT  });

async function getConnection() {
  const connection = await mysql.createConnection({
    host:process.env.DB_HOST,    
    user:process.env.DB_USER,           
    password:process.env.DB_PASSWORD, 
    database:process.env.DB_NAME,
    port:process.env.DB_PORT,
    timezone:'+09:00'
  })
  return connection;
}

module.exports = getConnection;
