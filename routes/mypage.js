const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const path = require('path');

// 세션 검사
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// ✅ 마이페이지 EJS 렌더링
router.get('/', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    const db = await getConnection();
    const userId = req.session.user.id;

    console.log('세션ID:',userId);

    // 사용자 정보 조회
    const [[user]] = await db.query('SELECT * FROM yolos WHERE id = ?', [userId]);
     console.log('사용자정보:',user);
    // 주문 내역 조회
    const [orders] = await db.query(`
  SELECT
    o.id AS id, o.status, o.total_price, o.created_at,
    ANY_VALUE(p.name) AS name,
    ANY_VALUE(i.color) AS color,
    SUM(i.quantity) AS qty,
    SUM(i.price * i.quantity) AS items_total,
    ANY_VALUE(p.thumb) AS thumb
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  JOIN products p ON p.id = i.product_id
  WHERE o.user_id = ?
  GROUP BY o.id
  ORDER BY o.id DESC
`, [userId]);

    console.log('렌더링 직전 최신 주문',orders.map(o => o.id));

    console.log('렌더링 직전 user:',user);
     console.log('렌더링 직전 orders:',orders);
    res.render('mypage', { user, orders });
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