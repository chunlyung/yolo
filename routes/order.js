const express = require('express');
const router = express.Router();
const getConnection = require('../db');


// 주문 저장
/*router.post('/', async (req, res) => {
  const conn = await getConnection(); // 여기서 바로 연결 받아야 함
  try {
    const { cart = [], total_price = 0, postcode = '', address = '', address_detail = '', request_memo = '' } = req.body;
    const user = req.session.user;

   console.log('주문요청시작');
   console.log('세션유저',user);
   console.log('카트정보',cart);


    if (!user || !cart || cart.length === 0) {
      return res.status(400).send('잘못된 요청입니다.');
    }

    await conn.beginTransaction(); // ✅ 트랜잭션 시작

    const [orderResult] = await conn.execute(
      `INSERT INTO orders (user_id, total_price, postcode, address, address_detail, request_memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, total_price, postcode, address, address_detail, request_memo.trim()]
    );
    const orderId = orderResult.insertId;

    console.log('주문 db저장 완료',orderId);

    for (const item of cart) {
      const productId = parseInt(item.id, 10);
      const qty = parseInt(item.quantity, 10);
      const price = parseInt(item.price, 10);

      if (Number.isNaN(productId) || Number.isNaN(qty) || Number.isNaN(price)) {
        console.error('❌ 잘못된 주문 데이터:', item);
        continue;
      }

      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price, color, product_name, option_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, productId, qty, price, item.color, item.name, item.color]
      );
    }

    await conn.commit(); // ✅ 커밋
    console.log('주문 커밋완료',orderId);
    req.session.cart = null;
    res.redirect(`/order/success?orderId=${orderId}`);
  } catch (err) {
    await conn.rollback(); // ❌ 실패 시 롤백
    console.error('❌ 주문 저장 오류:', err);
    res.status(500).send('서버 오류');
  } finally {
    await conn.end(); // ✅ 연결 종료
  }
});*/



// order.js
router.post('/cache-info', (req, res) => {
  const { postcode, address, address_detail, request_memo } = req.body;
  req.session.checkoutInfo = { postcode, address, address_detail, request_memo };
  res.json({ success: true });
});

/*// 주문 조회용 JSON
router.get('/info/:id', async (req, res) => {
  const conn = await getConnection();

  const [rows] = await conn.execute(`
    SELECT id, total_price, created_at,
           postcode, address, address_detail, request_memo
    FROM orders WHERE id = ?
  `, [req.params.id]);

  if (rows.length === 0) {
    return res.status(404).json({ error: '주문 없음' });
  }

  const order = rows[0];

  const [items] = await conn.execute(`
    SELECT oi.quantity, oi.price, oi.color,
           p.name, p.thumb
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [order.id]);

  await conn.end();
  res.json({ ...order, items });
});*/

// 주문 완료 페이지
router.get('/success', async (req, res) => {
  const conn = await getConnection();
  const orderId = req.query.orderId;

  const [rows] = await conn.execute(`
    SELECT id, total_price, created_at,
           postcode, address, address_detail, request_memo
    FROM orders WHERE id = ?
  `, [orderId]);

  if (rows.length === 0) {
    return res.status(404).send('주문 정보를 찾을 수 없습니다.');
  }

  const order = rows[0];

  const [items] = await conn.execute(`
    SELECT oi.quantity, oi.price, oi.color,
           p.name, p.thumb
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [orderId]);

  await conn.end();
  res.render('success', { order, items });
});


router.post('/cancel/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).send('로그인 필요');
  const db = await getConnection();
  const userId = req.session.user.id;
  const orderId = req.params.id;

  const [[order]] = await db.query(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [orderId, userId]);
  if (!order) return res.status(404).send('해당 주문 없음');

  if (order.status !== '결제완료') {
    return res.status(400).send('이미 처리된 주문입니다.');
  }

  await db.query(`UPDATE orders SET status = '취소요청' WHERE id = ?`, [orderId]);
  res.redirect('/mypage');
});

/*
router.get('/info/:id', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const db = await getConnection();
  const orderId = req.params.id;
  const userId = req.session.user.id;

  const [[order]] = await db.query(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [orderId, userId]);
  if (!order) return res.status(404).send('해당 주문 없음');

  const [items] = await db.query(`
    SELECT i.quantity, i.price, i.color, p.name, p.thumb
    FROM order_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.order_id = ?
  `, [orderId]);

  res.render('order-detail', { order, items });
});
*/




// GET /order/info/:id - 주문 상세정보 반환 (JSON)
router.get('/info/:id', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }

  const db = await getConnection();
  const userId = req.session.user.id;
  const orderId = req.params.id;

  try {
    // 주문 기본 정보
    const [[order]] = await db.query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    );
    if (!order) {
      return res.status(404).json({ success: false, message: '주문 없음' });
    }

    // 주문 상품들
    const [items] = await db.query(`
      SELECT
        CAST(i.id AS UNSIGNED) AS order_item_id,   -- ✅ 숫자로 강제 변환
        i.color, i.quantity, i.price,
        p.name, p.thumb,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS has_review
      FROM order_items i
      JOIN products p ON p.id = i.product_id
      LEFT JOIN reviews r
        ON r.order_item_id = i.id
       AND r.user_id = ?
      WHERE i.order_id = ?
    `, [userId, orderId]);

    // JSON 안전하게 변환
    const plainItems = items.map(it => ({
      order_item_id: Number(it.order_item_id),
      name: it.name,
      color: it.color,
      price: it.price,
      quantity: it.quantity,
      thumb: it.thumb,
      has_review: !!it.has_review
    }));

    res.json({
      items: plainItems,
      postcode: order.postcode,
      address: order.address,
      address_detail: order.address_detail,
      request_memo: order.request_memo,
      tracking_number: order.tracking_number
    });
  } catch (err) {
    console.error('상세정보 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});
module.exports = router;
