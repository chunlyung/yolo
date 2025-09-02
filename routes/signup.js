const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const getConn = require('../db');

// 금액 상수(원하는 값으로 조정)
const SIGNUP_BONUS = 1000;

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/signup', async (req, res) => {
  const {
    userid, email, user_name, password, passwordConfirm,
    phoneNumber1, phoneNumber2, phoneNumber3,
    postcode, address, address_detail,
    agree_all, agree_terms, agree_age, agree_sms
  } = req.body;

  if (!userid || !email || !user_name || !password || !passwordConfirm)
    return res.status(400).send('필수 항목을 모두 입력해주세요.');
  if (password !== passwordConfirm)
    return res.status(400).send('비밀번호가 일치하지 않습니다.');

  const fullPhone = `${phoneNumber1}-${phoneNumber2}-${phoneNumber3}`.trim();

  const db = await getConn();
  try {
    // 아이디 중복 검사
    const [[dup]] = await db.query('SELECT 1 FROM yolos WHERE userid=? LIMIT 1', [userid]);
    if (dup) return res.status(409).send('이미 존재하는 아이디입니다.');

    const hashed = await bcrypt.hash(password, 10);

    // 트랜잭션 시작
    await db.beginTransaction();

    // 1) 회원 INSERT
    const sql = `
      INSERT INTO yolos
        (userid,email,name,password,fullPhone,postcode,address,address_detail,
         agree_all,agree_terms,agree_age,agree_sms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    const [r] = await db.query(sql, [
      userid, email, user_name, hashed,
      fullPhone || null, postcode || null,
      address || null,  address_detail || null,
      agree_all ? 1 : 0, agree_terms ? 1 : 0,
      agree_age ? 1 : 0, agree_sms ? 1 : 0
    ]);

    // 2) 방금 생성된 PK
    const newUserId = r.insertId;

    // 3) ✅ 회원가입 적립 INSERT (지금 여기!)
    await db.query(
      `INSERT INTO points_ledger (user_id, amount, type, ref_type, ref_id, memo)
       VALUES (?, ?, '신규회원쿠폰', 'signup', NULL, '유효기간:~2099.12.31')`,
      [newUserId, SIGNUP_BONUS]
    );

    // 커밋
    await db.commit();

    // 4) 세션 세팅 후 리다이렉트
    const [[user]] = await db.query('SELECT * FROM yolos WHERE id=? LIMIT 1', [newUserId]);
    req.session.user = {
      id: user.id, userid: user.userid, name: user.name, email: user.email,
      phone: user.fullPhone, address: user.address, address_detail: user.address_detail,
      postcode: user.postcode
    };
    req.session.userid = user.userid;

    req.session.save(err => {
      if (err) console.error('세션 저장 오류:', err);
      return res.redirect('/mypage');
    });
  } catch (err) {
    try { await db.rollback(); } catch(e){}
    console.error('회원가입 오류:', err);
    return res.status(500).send('회원가입 실패');
  }
});

module.exports = router;