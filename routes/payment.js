const express = require("express");
const router = express.Router();
const axios = require("axios");
const getConnection = require("../db");

// payment.js (또는 이 파일의 결제 콜백 라우터)
router.get('/success', async (req, res) => {
  const { paymentKey, orderId, amount } = req.query;
  const db = await getConnection();
  const secretKey = 'live_gsk_EP59LybZ8B9gG7AW0O7br6GYo7pR';

  try {
    // 1) 토스 결제 승인
    const result = await axios.post(
      'https://api.tosspayments.com/v1/payments/confirm',
      { paymentKey, orderId, amount: parseInt(amount, 10) },
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
          'Content-Type': 'application/json'
        }
      }
    );
    const payment = result.data;

    // 2) 세션 확인
    const user = req.session.user;
    const cart = req.session.cart;
    const info = req.session.checkoutInfo || {};
    if (!user || !cart || cart.length === 0) {
      return res.status(400).send('장바구니 없음 또는 로그인 필요');
    }

    // 3) 금액 일치 여부 체크 (토스 금액 vs 우리가 계산한 금액)
    const payable = parseInt(info.payable_total || 0, 10);
    if (payable !== parseInt(payment.totalAmount, 10)) {
      console.error('금액 불일치:', payable, payment.totalAmount);
      return res.status(400).send('결제 금액 불일치');
    }

    // 4) 적립금 잔액 확인
    const [[bal]] = await db.query(
      'SELECT COALESCE(SUM(amount),0) AS balance FROM points_ledger WHERE user_id=?',
      [user.id]
    );
    const currBalance = bal.balance || 0;
    const usePts = Math.max(0, parseInt(info.used_points || 0, 10));
    if (usePts > currBalance) {
      return res.status(400).send('적립금 잔액 부족');
    }

    // 5) 주문/아이템/적립금 차감 트랜잭션
    await db.beginTransaction();

    const now = new Date();
    const [orderResult] = await db.execute(
      `INSERT INTO orders (user_id, total_price, postcode, address, address_detail, request_memo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '결제완료', ?, ?)`,
      [user.id, payment.totalAmount, info.postcode || '', info.address || '', info.address_detail || '', (info.request_memo || '').trim(), now, now]
    );
    const dbOrderId = orderResult.insertId;

    for (const item of cart) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price, color, product_name, option_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dbOrderId, item.id, item.quantity, item.price, item.color, item.name, item.color]
      );
    }

    // ✅ 6) 적립금 사용 차감 (음수)
    if (usePts > 0) {
      await db.query(
        `INSERT INTO points_ledger (user_id, amount, type, ref_type, ref_id, memo)
         VALUES (?, ?, '사용차감', 'order', ?, '주문 사용 차감')`,
        [user.id, -usePts, dbOrderId]
      );
    }

    await db.commit();

    // 7) 세션 정리
    req.session.cart = null;
    req.session.checkoutInfo = null;

    // 8) 주문완료 페이지로
    res.redirect(`/order/success?orderId=${dbOrderId}`);
  } catch (err) {
    await db.rollback?.();
    console.error('❌ 결제 후 주문 저장 오류', err.response?.data || err.message);
    res.status(500).send('결제 성공 후 주문 저장 실패');
  } finally {
    await db.end?.();
  }
});

router.get("/fail", (req, res) => {
  res.send(`<script>alert("❌ 결제에 실패했습니다. 다시 시도해주세요."); window.location.href="/";</script>`);
});

module.exports = router;
