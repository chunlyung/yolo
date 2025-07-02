const express       = require('express');
const requireAdmin  = require('../middlewares/requireAdmin');
const getConn       = require('../db');
const multer  = require('multer');
const router = express.Router();
const path =require('path');

/* ───── 모든 /admin/* 는 관리자 인증 필요 ───── */
router.use(requireAdmin);

/* ───── 대시보드 ───── */
/* ─── ① 추가: /admin 대시보드 ─── */
router.get('/', async (req, res) => {
  // 간단 통계 예시 (생략 가능)
  const db = await getConn();
  const [[{cnt: orderCnt}]] = await db.query('SELECT COUNT(*) cnt FROM orders');
  const [[{cnt: userCnt }]] = await db.query('SELECT COUNT(*) cnt FROM yolos WHERE is_admin = 0');

  res.render('admin-dashboard', {
    admin : req.session.admin,
    stats : { orders: orderCnt, users: userCnt }
  });
});
/* ───── 회원 목록 (검색) ───── */
router.get('/users', async (req, res) => {
  const keyword = req.query.keyword?.trim() || '';
  const db      = await getConn();

  let sql = `
    SELECT userid, email, name, fullPhone, created_at
    FROM   yolos
    WHERE  is_admin = 0
  `;
  const params = [];

  if (keyword) {
    sql += ` AND (
        userid     LIKE ?
      OR name       LIKE ?
      OR email      LIKE ?
      OR fullPhone  LIKE ?
    )`;
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }

  const [users] = await db.query(sql, params);

  res.render('admin-users', {
    admin  : req.session.admin,
    users,
    keyword
  });
});

/* ───── 회원 상세 보기 ───── */
router.get('/users/:userid', async (req, res) => {
  const db          = await getConn();
  const { userid }  = req.params;

  const [[user]] = await db.query(
    `SELECT userid, email, name, fullPhone, created_at, last_login, is_active
       FROM yolos
      WHERE userid = ? AND is_admin = 0`,
    [userid]
  );

  if (!user) return res.status(404).render('404');

  res.render('admin-user-detail', {
    admin: req.session.admin,
    user
  });
});

/* ───── 회원 수정 폼 ───── */
router.get('/users/:userid/edit', async (req, res) => {
  const db         = await getConn();
  const { userid } = req.params;
  const [[user]]   = await db.query(
    `SELECT userid, email, name, fullPhone
       FROM yolos
      WHERE userid = ? AND is_admin = 0`,
    [userid]
  );
  if (!user) return res.status(404).render('404');

  res.render('admin-user-edit', { admin: req.session.admin, user, errors: null });
});

/* ───── 회원 정보 업데이트 ───── */
router.post('/users/:userid/edit', async (req, res) => {
  const db         = await getConn();
  const { userid } = req.params;
  const { name, fullPhone, email } = req.body;

  /* 간단 유효성 검사 */
  const errors = {};
  if (!name?.trim())       errors.name       = '이름을 입력하세요';
  if (!/^\d{3}-\d{3,4}-\d{4}$/.test(fullPhone))
                          errors.fullPhone  = '전화번호 형식이 올바르지 않습니다';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
                          errors.email      = '이메일 형식이 올바르지 않습니다';

  if (Object.keys(errors).length) {
    const [[user]] = await db.query(
      `SELECT userid, email, name, fullPhone
         FROM yolos WHERE userid = ?`,
      [userid]
    );
    return res.render('admin-user-edit', { admin: req.session.admin, user, errors });
  }

  await db.query(
    `UPDATE yolos SET name=?, fullPhone=?, email=? WHERE userid=?`,
    [name.trim(), fullPhone.trim(), email.trim(), userid]
  );

  res.redirect(`/admin/users/${encodeURIComponent(userid)}`);
});

/* ───── 회원 탈퇴(비활성화) ───── */
router.post('/users/:userid/delete', async (req, res) => {
  const db         = await getConn();
  const { userid } = req.params;

  /* 실제 삭제 대신 is_active 플래그만 0 으로 */
  await db.query(
    `UPDATE yolos SET is_active = 0 WHERE userid = ? AND is_admin = 0`,
    [userid]
  );
  res.redirect('/admin/users');
});
router.post('/logout', (req, res) => {
  delete req.session.admin;
  res.redirect('/admin/login');
});




/* ───── 주문 관리 서브라우터 (/admin/orders) ───── */
router.get('/orders', async (req, res) => {
  const { q = '', status = '' } = req.query;     // 검색어 / 상태필터
  const db = await getConn();

  let sql = `
    SELECT o.id, o.total_price, o.status, o.created_at,
           u.userid, u.name
      FROM orders o
      JOIN yolos u ON u.id = o.user_id
     WHERE 1
  `;
  const params = [];

  if (q.trim()) {
    sql += ` AND (o.id = ? OR u.userid LIKE ? OR u.name LIKE ?)`;
    params.push(q.trim(), `%${q.trim()}%`, `%${q.trim()}%`);
  }
  if (status) {
    sql += ` AND o.status = ?`;
    params.push(status);
  }

  const [orders] = await db.query(sql, params);

  res.render('admin-orders', {
    admin: req.session.admin,
    orders,
    q,
    status
  });
});

/* ───── 주문 상세 ───── */
router.get('/orders/:id', async (req, res) => {
  const db = await getConn();
  const { id } = req.params;

  const [[order]] = await db.query(`
    SELECT o.*, u.userid, u.name, u.email, u.fullPhone
      FROM orders o
      JOIN yolos u ON u.id = o.user_id
     WHERE o.id = ?
  `, [id]);

  if (!order) return res.status(404).render('404');

  const [items] = await db.query(`
    SELECT *
      FROM order_items
     WHERE order_id = ?
  `, [id]);

  res.render('admin-order-detail', {
    admin: req.session.admin,
    order,
    items,
    statuses: ['결제완료','상품준비','배송중','배송완료','취소요청','취소완료']
  });
});

/* ───── 주문 상태 업데이트 ───── */
router.post('/orders/:id/status', async (req, res) => {
  const db = await getConn();
  const { id } = req.params;
  const { status } = req.body;

  await db.query(
    `UPDATE orders SET status = ? WHERE id = ?`,
    [status, id]
  );
  res.redirect(`/admin/orders/${id}`);
});


// ───────────── 관리자 권한 확인 미들웨어 ─────────────
function isAdmin(req, res, next) {

 if (req.session.user) {
    console.log('세션 is_admin 타입:', typeof req.session.user.is_admin, req.session.user.is_admin);
  }


  if (req.session.user && req.session.user.is_admin == 1) {
    return next();
  } else {
    res.status(403).send('관리자만 접근 가능합니다.');
  }
}

// ───────────── Multer 설정 (썸네일 업로드용) ─────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ───────────── 상품 관리 ─────────────

// 상품 목록 + 등록 폼
router.get('/products', isAdmin, async (req, res) => {
  const db = await getConn();
  const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
  res.render('admin/products', { products });
});

// 상품 신규 등록
router.post('/products', isAdmin, upload.single('thumb'), async (req, res) => {
  const db = await getConn();
  const {
  name, option, price, stock, color,
  hover_img1, hover_img2,
  size_info, description_html,
  detail_subtitle,
  detail_img1, detail_img2, detail_img3, detail_img4, detail_img5,
  detail_img6, detail_img7, detail_img8,
  hover_img_list ,color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2
} = req.body;

const thumb = req.file ? `/uploads/${req.file.filename}` : null;

await db.query(
  `INSERT INTO products
    (name, \`option\`, price, stock, color, thumb,
     hover_img1, hover_img2, size_info, description_html,
     detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4, detail_img5,
       detail_img6, detail_img7, detail_img8,
      hover_img_list
     , color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,? ,? ,? , ? ,? ,? ,? ,? ,? ,? ,?)`,
  [
    name.trim(), option.trim(), price, stock, color, thumb,
    hover_img1, hover_img2, size_info, description_html,
    detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4, detail_img5,
      detail_img6, detail_img7, detail_img8,
  hover_img_list,
     color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2
  ]
);
  res.redirect('/admin/products');
});

// 상품 수정
router.post('/products/:id/update', isAdmin, upload.single('thumb'), async (req, res) => {
  console.log('수정요청',req.body.detail_img5);
  const db = await getConn();
  const { id } = req.params;
 const {
    name, option, price, stock, color,
    hover_img1, hover_img2,
    size_info, description_html,
    detail_subtitle,
    detail_img1, detail_img2, detail_img3, detail_img4, detail_img5, detail_img6, detail_img7, detail_img8,
   hover_img_list, color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2
  } = req.body;

  if (req.file) {
    const thumb = `/uploads/${req.file.filename}`;
    await db.query(
  `UPDATE products SET
    name = ?, \`option\` = ?, price = ?, stock = ?, color = ?, thumb = ?,
    hover_img1 = ?, hover_img2 = ?, size_info = ?, description_html = ?,
    detail_subtitle = ?, detail_img1 = ?, detail_img2 = ?, detail_img3 = ?, detail_img4 = ?,
    detail_img5 = ?, detail_img6 = ?, detail_img7 = ?, detail_img8 = ?,
     hover_img_list = ?,
     color_title1 = ?, color_img1 = ?, color_desc1 = ?,
  color_title2 = ?, color_img2 = ?, color_desc2 =?
   WHERE id = ?`,
  [
    name.trim(), option.trim(), price, stock, color, `/uploads/${req.file.filename}`,
    hover_img1, hover_img2, size_info, description_html,
    detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4, detail_img5,
      detail_img6, detail_img7, detail_img8,
     hover_img_list,
     color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2,
    id
  ]
);
  } else {
    await db.query(
  `UPDATE products SET
    name = ?, \`option\` = ?, price = ?, stock = ?, color = ?,
    hover_img1 = ?, hover_img2 = ?, size_info = ?, description_html = ?,
    detail_subtitle = ?, detail_img1 = ?, detail_img2 = ?, detail_img3 = ?, detail_img4 = ?
    , detail_img5 = ?, detail_img6 = ?, detail_img7 = ?, detail_img8 = ?,
   hover_img_list = ? , color_title1 = ?, color_img1 = ?, color_desc1 = ?,
  color_title2 = ?, color_img2 = ?, color_desc2 =?
   WHERE id = ?`,
  [
    name.trim(), option.trim(), price, stock, color,
    hover_img1, hover_img2, size_info, description_html,
    detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4, detail_img5,
      detail_img6, detail_img7, detail_img8,
     hover_img_list,
     color_title1, color_img1, color_desc1,
  color_title2, color_img2, color_desc2 ,
    id
  ]
);
  }

  res.redirect('/admin/products');
});

// 상품 삭제
router.post('/products/:id/delete', isAdmin, async (req, res) => {
  const db = await getConn();
  await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.redirect('/admin/products');
});


router.get('/products/:id', async (req, res) => {
  console.log('detail_img5:',product.detail_img5);
  try {
    const id = req.params.id;
    const db = await getConn();
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);

    if (rows.length === 0) return res.status(404).send('해당 상품이 없습니다');

    const product = rows[0];

    // 상세 페이지 렌더링 (템플릿 이름은 너가 원하는 대로)
    res.render('admin/admin-product-detail', { product });

  } catch (err) {
    console.error('❌ 관리자 상품 상세 오류:', err);
    res.status(500).send('서버 오류');
  }
});
module.exports = router;

