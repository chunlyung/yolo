// routes/products.js
console.log("products라우터 로딩됨");
const express = require('express');
const router = express.Router();
const getConn = require('../db');

router.get('/', async (req, res) => {
  try {
    const db = await getConn();
    const [products] = await db.query('SELECT * FROM products ORDER BY id DESC');
    console.log('📦 조회된 products:', products);
    res.render('shop', { products });
  } catch (err) {
    console.error('❌ 제품 목록 불러오기 실패:', err);
    res.status(500).send('서버 오류');
  }
});


module.exports = router;