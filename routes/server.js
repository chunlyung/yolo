const express  = require('express');
const session  = require('express-session'); // ← app.js에서만 써도 OK
const bcrypt   = require('bcrypt');
const getConnection  = require('../db');           // mysql2/promise 연결 함수
const path     = require('path');

const router = express.Router();

/* 필수 미들웨어 */
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

/* ───────── 1. 로그인 처리 ───────── */
router.post('/login', async (req, res) => {
  try {
    const { userid, password } = req.body;
    const db       = await getConnection();                              // promise 스타일
    const [rows]   = await db.query(
      'SELECT * FROM yolos WHERE (userid = ? OR email = ?) AND deleted =0',
      [userid, userid]
    );
    const user = rows[0];

    /* 존재 여부 & 비밀번호 확인 */
    if (!user) {
      return res.json({ success: false, message: '존재하지 않는 계정입니다.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: '비밀번호가 틀렸습니다.' });
    }

    /* ✔️ 로그인 성공 → 세션 저장 */
    req.session.user   = {
      id: user.id,
      userid : user.userid,
      name: user.name,
      email: user.email,
      phone: user.fullPhone,
      address: user.address,
      address_detail:user.address_detail,
      postcode:user.postcode,
      is_admin:user.is_admin
    };
    req.session.userid = user.userid;

    return res.json({ success: true });     
  } catch (err) {
    console.error('로그인 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

router.get('/auth/status',(req,res)=>{
  res.json({
    loggedIn: !!req.session.user,
    user: req.session.user || null
  });
});



module.exports = router;