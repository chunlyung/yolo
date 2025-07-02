const express = require('express');
const router = express.Router();
const getConnection = require('../db');

router.get('/', async (req, res) => {
  const keyword = (req.query.keyword || '').toLowerCase().replace(/\s/g, '');

  const db = await getConnection();
  try {
    const [rows] = await db.query(`
      SELECT id, name, price, thumb AS image
      FROM products
      WHERE REPLACE(LOWER(name), ' ', '') LIKE ?
    `, [`%${keyword}%`]);

    res.render('search', { products: rows, keyword });
  } catch (err) {
    console.error('검색 오류:', err);
    res.status(500).send('서버 오류');
  }
});

module.exports = router;
