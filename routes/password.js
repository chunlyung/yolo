const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

router.get('/forgot', (req, res) => {
  res.render('forgot'); // 👉 EJS 템플릿으로 렌더링
});



// ✅ 네이버 이메일 SMTP 설정
const transporter = nodemailer.createTransport({
  host: 'smtp.naver.com',
  port: 465,
  secure: true,
  auth: {
    user: 'yangpang3@naver.com',  // 네이버 이메일 주소
    pass: 'B1UKYTLRJR96'     // 네이버 비밀번호 (SMTP 허용 설정 필수)
  }
});

// [1] 비밀번호 재설정 요청
router.post('/forgot', async (req, res) => {
  const { email,name } = req.body;
  const db = await getConnection();
  const [users] = await db.query('SELECT * FROM yolos WHERE email = ? AND name = ?', [email,name]);

  if (users.length === 0) {
    return res.send('이메일과 이름이 일치하는 사용자가 없습니다.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expire = Date.now() + 1000 * 60 * 15; // 15분 유효

  await db.query(
    'UPDATE yolos SET reset_token = ?, reset_expire = ? WHERE email = ?',
    [token, expire, email]
  );

  const resetLink = `http://localhost:3000/reset/${token}`;

  await transporter.sendMail({
    from: 'yangpang3@naver.com',
    to: email,
    subject: '비밀번호 재설정',
    html: `
  <div style="font-family: Arial, sans-serif; padding: 30px; background-color: #f9f9f9; color: #333;">
    <h1 style="font-size: 28px; font-weight: bold; color: #2c3e50; margin-bottom: 10px;">YOLO</h1>
    <p style="font-size: 16px; line-height: 1.6;">
      요청하신 <strong>비밀번호 재설정 링크</strong>는 아래 버튼을 클릭해 주세요:
    </p>
    <a href="${resetLink}" style="
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background-color: #2c3e50;
      color: #ffffff;
      text-decoration: none;
      font-size: 16px;
      font-weight: bold;
      border-radius: 5px;
    ">비밀번호 재설정하기</a>
    <p style="margin-top: 40px; font-size: 12px; color: #888;">
      ※ 이 링크는 15분 동안만 유효합니다.
    </p>
  </div>
`
  });

  res.send('비밀번호 재설정 링크를 이메일로 보냈습니다.');
});

// [2] 비밀번호 재설정 화면
router.get('/reset/:token', async (req, res) => {
  const { token } = req.params;
  const db = await getConnection();

  const [users] = await db.query('SELECT * FROM yolos WHERE reset_token = ?', [token]);

  if (!users.length || Date.now() > users[0].reset_expire) {
    return res.send('유효하지 않거나 만료된 링크입니다.');
  }

  res.render('reset-password', { email: users[0].email });
});

// [3] 새 비밀번호 저장
router.post('/reset', async (req, res) => {
  const { email, password } = req.body;
  const db = await getConnection();
  const bcrypt = require('bcrypt');

  const hashed = await bcrypt.hash(password, 10);
  await db.query(
    'UPDATE yolos SET password = ?, reset_token = NULL, reset_expire = NULL WHERE email = ?',
    [hashed, email]
  );

  res.send('비밀번호가 변경되었습니다. 다시 로그인하세요.');
});

module.exports = router;
