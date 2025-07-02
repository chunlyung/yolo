const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const getConn = require('../db');

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/signup', async (req, res) => {
  const {
    userid, email, user_name, password, passwordConfirm,
    phoneNumber1, phoneNumber2, phoneNumber3,
    postcode, address, address_detail,
    agree_all, agree_terms, agree_age, agree_sms
  } = req.body;

  /* -------- 입력 검증 -------- */
  if (!userid || !email || !user_name || !password || !passwordConfirm)
    return res.status(400).send('필수 항목을 모두 입력해주세요.');
  if (password !== passwordConfirm)
    return res.status(400).send('비밀번호가 일치하지 않습니다.');

  const fullPhone = `${phoneNumber1}-${phoneNumber2}-${phoneNumber3}`.trim();

  try {
    const db = await getConn();

    // 아이디 중복 검사
    const [[dup]] = await db.query('SELECT 1 FROM yolos WHERE userid = ? LIMIT 1', [userid]);
    if (dup) return res.status(409).send('이미 존재하는 아이디입니다.');

    // INSERT
    const hashed = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO yolos
        (userid,email,name,password,fullPhone,
         postcode,address,address_detail,
         agree_all,agree_terms,agree_age,agree_sms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    await db.query(sql, [
      userid, email, user_name, hashed,
      fullPhone || null, postcode || null,
      address || null,  address_detail || null,
      agree_all ? 1 : 0, agree_terms ? 1 : 0,
      agree_age ? 1 : 0, agree_sms ? 1 : 0
    ]);

    /* ---------- ⚠️ 핵심: 로그인과 동일한 세션 저장 ---------- */
    const [rows] = await db.query('SELECT * FROM yolos WHERE userid = ? LIMIT 1', [userid]);
    const user   = rows[0];                    // 방금 만든 계정

    req.session.user = {                       // front-end 에서 쓰는 구조 그대로
      id:           user.id,
      userid:       user.userid,
      name:         user.name,
      email:        user.email,
      phone:        user.fullPhone,
      address:      user.address,
      address_detail: user.address_detail,
      postcode:     user.postcode
    };

    req.session.userid = user.userid;          // /mypage/userinfo 가 찾는 값  ✅

    /* ✅  redirect 전에 세션을 확실히 저장 */
    req.session.save(err => {
      if (err) console.error('세션 저장 오류:', err);
      /* 로그인과 동일하게 마이페이지 HTML 로 이동 */
      return res.redirect('/mypage');
    });
  } catch (err) {
    console.error('회원가입 오류:', err);
    return res.status(500).send('회원가입 실패');
  }
});

module.exports = router;