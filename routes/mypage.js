const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const path = require('path');

// 세션 검사
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// routes/mypage.js (라우트 핸들러 전체 교체)
router.get('/', async (req, res) => {
  const db = await getConnection();
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.redirect('/login');

    // 1) 사용자
    const [[user]] = await db.query('SELECT * FROM yolos WHERE id=?', [userId]);

    // 2) 주문 요약 (네가 원래 쓰던 형태 유지)
    const [orders] = await db.query(`
      SELECT
        o.id AS id,
        o.status,
        o.total_price,
        o.created_at,
        o.request_memo,
        o.postcode,
        o.address,
        o.address_detail,
        o.tracking_number,
        ANY_VALUE(p.name)          AS name,
        ANY_VALUE(i.color)         AS color,
        SUM(i.quantity)            AS qty,
        SUM(i.price * i.quantity)  AS items_total,
        ANY_VALUE(p.thumb)         AS thumb
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      JOIN products    p ON p.id       = i.product_id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.id DESC
    `, [userId]);

    // 3) 주문항목 전체 (리뷰/상세용)
    const [items] = await db.query(`
  SELECT
    oi.id            AS order_item_id,
    oi.order_id,
    oi.product_id,
    oi.product_name  AS name,
    oi.color,
    oi.quantity      AS qty,
    oi.price,
    p.thumb          AS thumb,
    CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS has_review  
  FROM order_items oi
  JOIN orders o        ON o.id = oi.order_id AND o.user_id = ?
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN reviews r  ON r.order_item_id = oi.id AND r.user_id = ? 
  ORDER BY o.created_at DESC, oi.id DESC
`, [userId, userId]);  // ← 파라미터 2개
 // ← 백틱 닫힘 + 파라미터 배열 + 세미콜론 OK

    // 4) order_id 기준으로 묶기
    const byOrder = new Map();
    for (const it of items) {
      const k = Number(it.order_id);
      if (!byOrder.has(k)) byOrder.set(k, []);
      byOrder.get(k).push(it);
    }

    // 5) orders 배열에 items 붙이기 (불변)
    const ordersWithItems = orders.map(o => ({
      ...o,
      items: byOrder.get(Number(o.id)) || []
    }));
    // 6) ✅ 적립금: 잔액 + 최근 내역
const [[bal]] = await db.query(
  'SELECT COALESCE(SUM(amount),0) AS balance FROM points_ledger WHERE user_id=?',
  [userId]
);
const [points] = await db.query(
   `SELECT
       id,
       amount,
       type,
       ref_type,
       ref_id,
       memo,
       DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+09:00'), '%Y-%m-%d %H:%i') AS created_at_text
    FROM points_ledger
    WHERE user_id=?
    ORDER BY created_at DESC
    LIMIT 50`,
   [userId]
 );

// 7) 렌더
return res.render('mypage', {
  user,
  orders: ordersWithItems,
  points,
  point_balance: bal?.balance ?? 0
});


  } catch (err) {
    console.error('mypage 에러:', err);
    res.status(500).send('서버 오류');
  }

});







// ✅ 회원 정보 수정
router.post('/update', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }

  const db = await getConnection();
  const userid = req.session.user.userid; // 세션의 userid

  const {
    email, user_name, fullPhone,
    address_detail,
    agree_sms,
  } = req.body;

  try {
    await db.query(`
      UPDATE yolos SET
        email = ?, name = ?, fullPhone = ?, address_detail = ?, agree_sms = ?
      WHERE userid = ?
    `, [email, user_name, fullPhone, address_detail, agree_sms ? 1 : 0, userid]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});


router.post('/withdraw', async (req, res) => {
  if (!req.session.user) return res.json({ success: false, message: '로그인 필요' });

  const userId = req.session.user.id;
  const db = await getConnection();

  try {
    await db.query('UPDATE yolos SET deleted = 1, deleted_at = NOW() WHERE id = ?', [userId]);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});




module.exports = router;