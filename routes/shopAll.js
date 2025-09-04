
const express = require('express');
const router = express.Router();
const getConn = require('../db');


router.get('/', async (req, res) => {
  const db = await getConn();
  const [products] = await db.query(`
    SELECT
      id,
      name,
  \`option\`,
      color,
      price,
      sale_price,
      thumb,
      is_new,
      hover_img_list
    FROM products
    ORDER BY id DESC
  `);
  res.render('shop-all', { products });
});

module.exports = router;