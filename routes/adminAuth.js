const express  = require('express');
const bcrypt   = require('bcrypt');
const getConn  = require('../db');       // ✨ DB 풀이 getConnection 등을 export
const router   = express.Router();

/* ───────── 로그인 폼 ───────── */
router.get('/login', (req, res) => {
  res.render('admin-login', { error: null });
});

/* ───────── 로그인 처리 ───────── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const db = await getConn();
  const [[admin]] = await db.query(
    'SELECT id, email, password, name FROM yolos WHERE email = ? AND is_admin = 1',
    [email]
  );

  console.log('관리자 쿼리 결과',admin);

  if (!admin) {
        console.log('관리자 계정 없음');
    return res.render('admin-login', { error: '관리자 계정이 없습니다.' });
  }
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok)   return res.render('admin-login', { error: '비밀번호가 틀렸습니다.' });

  // ✅ 세션에 관리자 전용 정보 저장
  req.session.admin = { id: admin.id, email: admin.email, name: admin.name };

// ⭐ 관리자 로그인도 user로 취급해서 세션 설정해야 isAdmin 미들웨어에서 통과됨
req.session.user = {
  id: admin.id,
  userid: admin.email,        // 사용자 로그인과 맞추기 위해 userid 대신 email 사용
  user_name: admin.name,
  is_admin: 1                 // 중요!! 관리자 권한
};

  console.log('로그인 성공 , 세션 저장 완료')
  res.redirect('/admin');
});`  `

/* ───────── 로그아웃 ───────── */
router.post('/logout', (req, res) => {
  delete req.session.admin;
  res.redirect('/admin/login');
});

module.exports = router;