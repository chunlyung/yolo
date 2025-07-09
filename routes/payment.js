const express = require("express");
const router = express.Router();
const axios = require("axios");
const getConnection = require("../db");

router.get("/success", async (req, res) => {
  const { paymentKey, orderId, amount } = req.query;
  const db = await getConnection();
  const secretKey = "live_sk_ALnQvDd2VJogavjbZJyYrMj7X41m";

  try {
    // ✅ 토스 결제 인증
    const result = await axios.post(
      "https://api.tosspayments.com/v1/payments/confirm",
      { paymentKey, orderId, amount: parseInt(amount) },
      {
        headers: {
          Authorization: "Basic " + Buffer.from(secretKey + ":").toString("base64"),
          "Content-Type": "application/json"
        }
      }
    );

    const payment = result.data;

    // ✅ 유저 / 장바구니 세션 확인
    const user = req.session.user;
    const cart = req.session.cart;
    if (!user || !cart || cart.length === 0) {
      return res.status(400).send("장바구니 없음 또는 로그인 필요");
    }

    const now= new Date();
      
    // ✅ 주문 저장
    await db.beginTransaction();



    const { postcode, address, address_detail, request_memo } = req.session.checkoutInfo || {};

    

    const [orderResult] = await db.execute(
      `INSERT INTO orders (user_id, total_price, postcode, address, address_detail, request_memo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, payment.totalAmount, postcode, address, address_detail, request_memo, '결제완료',now,now]
    );

    const dbOrderId = orderResult.insertId;
    for (const item of cart) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price, color, product_name, option_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dbOrderId, item.id, item.quantity, item.price, item.color, item.name, item.color]
      );
    }

    await db.commit();
    req.session.checkoutInfo=null;
    req.session.cart = null;

    // ✅ 주문완료 EJS 페이지로 리다이렉트
    res.redirect(`/order/success?orderId=${dbOrderId}`);
  } catch (err) {
    await db.rollback?.();
    console.error("❌ 결제 후 주문 저장 오류", err.response?.data || err.message);
    res.status(500).send("결제 성공 후 주문 저장 실패");
  } finally {
    await db.end();
  }
});

router.get("/fail", (req, res) => {
  res.send(`<script>alert("❌ 결제에 실패했습니다. 다시 시도해주세요."); window.location.href="/";</script>`);
});

module.exports = router;
