const express = require('express');
const router = express.Router();
const getConnection = require('../db');

// 카테고리별 상품 페이지
router.get('/:category', async (req, res) => {
  const category = req.params.category;
  const db = await getConnection();

  try {
    const [products] = await db.query('SELECT * FROM products WHERE category = ?', [category]);
    res.render('shop-category', { products, category });
  } catch (err) {
    console.error(err);
    res.status(500).send('서버 오류');
  }
});

module.exports = router;