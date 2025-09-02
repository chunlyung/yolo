
const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require("axios");
  const getConnection = require('../db');           // ← 없으면 상단 import

router.post('/purchase', async (req, res) => {
  const { cart, total_price } = req.body;
  const user = req.session.user;
  if (!user || !cart || cart.length === 0) {
    return res.status(400).json({ ok: false, message: '잘못된 요청' });
  }

  // 예시: 임시 주문 ID 생성
  const orderId = Date.now();

  // TODO: cart 정보 DB 저장 또는 세션 저장
  req.session.purchase = { cart, total_price, orderId };

  res.json({ ok: true, orderId });
});



// 1) 구매페이지 진입 (HTML 파일 보내주기)
router.get('/', (req, res) => {
    
  const user = req.session.user;
  const cart = req.session.cart;

  if (!user) return res.redirect('/login');
  if (!cart || cart.length === 0) return res.redirect('/cart');
  res.render('purchase',{user,cart});

});
// 2) 구매페이지용 데이터 API (user + cart + points)
router.get('/data', async (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart;

  if (!user) return res.status(401).json({ error: '로그인 필요' });
  if (!cart || cart.length === 0) return res.status(400).json({ error: '장바구니 비어 있음' });

  try {
    const db = await getConnection();
    const [[bal]] = await db.query(
      'SELECT COALESCE(SUM(amount),0) AS balance FROM points_ledger WHERE user_id=?',
      [user.id]
    );
    const userWithPoints = { ...user, points: bal.balance || 0 }; // ✅ points 추가
    res.json({ user: userWithPoints, cart });
  } catch (e) {
    console.error('purchase/data error:', e);
    res.status(500).json({ error: '서버 오류' });
  }
});



module.exports = router;