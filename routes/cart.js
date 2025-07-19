/* routes/cart.js */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const getConnection = require('../db');
router.use(express.json());
router.use(express.urlencoded({ extended: true }));



router.get('/', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.render('cart', { user, cart: [] });
  }

  try {
    const db = await getConnection();

    for (const item of cart) {
      const [rows] = await db.query(
        'SELECT stock FROM products_option WHERE product_id = ? AND color = ?',
        [item.id, item.color]
      );
      item.stock = rows[0]?.stock ?? 0;
    }

    await db.end();

    res.render('cart', { user, cart });
  } catch (err) {
    console.error('❌ 장바구니 stock 조회 실패:', err);
    res.status(500).send('서버에러: ' + err.message);
  }
});

/* -------------------- 1) 장바구니 담기 -------------------- */
/* POST /cart/add  –  items 배열 또는 단일 객체 모두 허용  */
router.post('/add', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  if (!req.session.cart) req.session.cart = [];          // 세션에 cart 없으면 배열 생성

  items.forEach(({ id, color, quantity, price, name, thumb }) => {
    const existing = req.session.cart.find(
      i => i.id === id && i.color === color
    );

    if (existing) {
      existing.quantity += parseInt(quantity, 10);
    } else {
      req.session.cart.push({
        id,
        name,
        color,
        price   : parseInt(price, 10),
        quantity: parseInt(quantity, 10),
        thumb
      });
    }
  });

  console.log('현재 세션 cart:', req.session.cart);
  return res.json({ ok: true });
});

/* -------------------- 2) 장바구니 페이지 -------------------- */

/* GET /cart/data  – 세션 cart JSON */
router.get('/data', async (req, res) => {

  const cart = req.session.cart || [];

  for (const item of cart) {
    const [rows] = await db.query(
      'SELECT stock FROM products_option WHERE product_id = ? AND color = ?',
      [item.id, item.color]
    );
    item.stock = rows[0]?.stock ?? 0;
  }

  res.json(cart);



});

/* -------------------- 3) 수량 변경 -------------------- */
router.post('/update', (req, res) => {
  const { id, color, quantity } = req.body;
  if (req.session.cart) {
    const item = req.session.cart.find(i => i.id === id && i.color === color);
    if (item) item.quantity = parseInt(quantity, 10);
  }
  res.json({ ok: true, cart: req.session.cart });
});

/* -------------------- 4) 삭제 -------------------- */
router.post('/remove', (req, res) => {
  const { id, color } = req.body;
  if (!req.session.cart) return res.json({ ok: false });

  req.session.cart = req.session.cart.filter(
    item => !(item.id == id && item.color == color)
  );

  res.json({ ok: true });
});
module.exports = router;