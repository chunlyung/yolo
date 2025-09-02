// routes/reviews.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const getConnection = require('../db');

const REVIEW_BONUS_TEXT  = 1000;  // 일반 리뷰
const REVIEW_BONUS_PHOTO = 2000;  // 포토 리뷰
// ===== 업로드 경로/스토리지 설정 =====
const UP_BASE = path.join(__dirname, '..', 'public', 'uploads', 'reviews');
// URL로 노출될 베이스 (express.static으로 /public 서빙하고 있다고 가정)
const PUBLIC_BASE_URL = '/uploads/reviews';

function ensureDirSync(dir){
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 날짜별 폴더
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = new Date();
    const folder = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dir = path.join(UP_BASE, folder);
    ensureDirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // 충돌 방지 파일명
    const ts = Date.now();
    const ext = path.extname(file.originalname || '');
    const safe = (path.basename(file.originalname || '', ext) || 'file').replace(/[^\w.-]+/g,'_');
    cb(null, `${ts}_${safe}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { files:10, fileSize: 30*1024*1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error('이미지/동영상만 업로드 가능합니다.'), ok);
  }
});


// ===== 유틸 =====
function detectMediaType(mimeOrName=''){
  const s = String(mimeOrName).toLowerCase();
  if (s.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(s)) return 'video';
  return 'image';
}

// 세션에서 로그인 사용자 id 가져오기 (프로젝트에 맞게 조정)
function getUserId(req){
  // ex) req.session.user.id 또는 req.session.userId …
  return req.session?.user?.id || req.session?.userId || req.user?.id;
}

/**
 * POST /reviews/create
 * body: order_item_id, rating, content
 * files: files[]
 */
router.post('/create', upload.array('files', 10), async (req, res) => {
  const db = await getConnection();
  const userId = getUserId(req);

  try {
    if (!userId) {
      return res.status(401).json({ success:false, message: '로그인이 필요합니다.' });
    }

    // 폼 데이터
    const orderItemId = Number(req.body.order_item_id || req.body.order_id || 0); // (호환처리)
    const rating = Number(req.body.rating || 0);
    const content = String(req.body.content || '').trim();

    if (!orderItemId) return res.json({ success:false, message:'order_item_id 누락' });
    if (!(rating >=1 && rating <=5)) return res.json({ success:false, message:'별점(1~5) 필수' });
    if (!content) return res.json({ success:false, message:'내용을 입력하세요.' });

    // 1) 주문항목 + 주문 상태 + 소유자 확인 (JOIN)
const [[oi]] = await db.query(
  `SELECT
      oi.id,
      oi.order_id,
      oi.product_id,
      oi.color,
      o.user_id,
      o.status
   FROM order_items AS oi
   JOIN orders AS o ON o.id = oi.order_id
   WHERE oi.id = ?`,
  [orderItemId]
);

if (!oi) {
  return res.json({ success:false, message:'주문 항목을 찾을 수 없습니다.' });
}

// 로그인 사용자 소유 주문인지 확인
if (Number(oi.user_id) !== Number(userId)) {
  return res.status(403).json({ success:false, message:'본인 주문만 리뷰 작성 가능' });
}

// 배송/수령 완료 상태만 허용 (네 ENUM 값에 맞춰 조정하세요)
const ALLOW_STATUSES = ['배송완료'];
if (!ALLOW_STATUSES.includes(String(oi.status))) {
  return res.json({ success:false, message:'배송완료 후에만 리뷰 작성이 가능합니다.' });
}

    // 2) 중복 리뷰 방지 (UNIQUE uq_review_per_item(order_item_id) 가정)
    const [[exist]] = await db.query(
      `SELECT id FROM reviews WHERE order_item_id=?`,
      [orderItemId]
    );
    if (exist) return res.json({ success:false, message:'이미 이 주문 항목으로 작성한 리뷰가 있습니다.' });

    await db.beginTransaction();

    // 3) reviews INSERT
    const [r1] = await db.query(
      `INSERT INTO reviews
       (user_id, product_id, order_item_id, rating, title, content, is_hidden, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 0, NOW(), NOW())`,
      [userId, oi.product_id, orderItemId, rating, content]
    );
    const reviewId = r1.insertId;

    // 4) review_media INSERT (파일이 있으면)
    const files = req.files || [];
    const mediaUrls = [];
    let hasPhoto = false;  // ★ 포토 여부
    for (let i=0; i<files.length; i++){
      const f = files[i];
      // 저장된 실제 경로 → 공개 URL
      const relFolder = path.basename(path.dirname(f.path)); // yyyy-mm-dd
      const url = `${PUBLIC_BASE_URL}/${relFolder}/${path.basename(f.path)}`;
      const type = detectMediaType(f.mimetype || f.originalname);

      if (type === 'image') hasPhoto = true;  // ★ 사진 있으면 true 


      await db.query(
        `INSERT INTO review_media (review_id, media_url, media_type, sort_no)
         VALUES (?, ?, ?, ?)`,
        [reviewId, url, type, i+1]
      );
      mediaUrls.push(url);
    }

      // 5) ✅ 리뷰 적립 (같은 트랜잭션)
    const bonus = hasPhoto ? REVIEW_BONUS_PHOTO : REVIEW_BONUS_TEXT;
    const memo  = hasPhoto ? '포토 리뷰 적립' : '일반 리뷰 적립';

    await db.query(
      `INSERT INTO points_ledger (user_id, amount, type, ref_type, ref_id, memo)
       VALUES (?, ?, '리뷰적립', 'review', ?, ?)`,
      [userId, bonus, reviewId, memo]
    );


    await db.commit();

    return res.json({ success:true, reviewId, mediaUrls, bonus });

  } catch (err){
    console.error('❌ 리뷰 등록 오류:', err);
    try { await db.rollback(); } catch(e){}
    // 멀터로 저장된 파일을 롤백 시 삭제할지 여부는 정책에 맞게 선택
    return res.status(500).json({ success:false, message:'서버 오류' });
  } finally {
    try { await db.release?.(); } catch(e){}
  }
});




// GET /reviews/of-order-item/:orderItemId  → 해당 주문항목의 "내 리뷰" 1개
router.get('/of-order-item/:orderItemId', async (req, res) => {
  const db = await getConnection();
  const userId = req.session?.user?.id;
  const orderItemId = Number(req.params.orderItemId || 0);

  if (!userId) return res.status(401).json({ success:false, message:'로그인 필요' });
  if (!orderItemId) return res.json({ success:false, message:'order_item_id 누락' });

  try {
    const [rows] = await db.query(
      `SELECT
          r.id, r.user_id, u.userid AS user_login, r.product_id, r.order_item_id,
          r.rating, r.content, r.created_at,
          oi.color AS color_name,
          p.name  AS product_name,
          GROUP_CONCAT(m.media_url ORDER BY m.sort_no SEPARATOR '|') AS medias
       FROM reviews r
       JOIN order_items oi ON oi.id = r.order_item_id
       JOIN products p     ON p.id = r.product_id
       LEFT JOIN review_media m ON m.review_id = r.id
       LEFT JOIN yolos u on u.id = r.user_id
       WHERE r.order_item_id=? AND r.user_id=? AND r.is_hidden=0
       GROUP BY r.id`,
      [orderItemId, userId]
    );  
   // 서버 라우터 내부에서 rows[0] 확정 후:
const r = rows[0];
const raw = String(r.user_login || '');
// 앞 3글자 + 나머지 '*', 최소 한 개는 '*' 붙임
const mask =
  raw.length <= 3 ? raw + '*' : raw.slice(0, 3) + '*'.repeat(Math.max(1, raw.length - 3));

return res.json({
  success: true,
  review: {
    id: r.id,
    rating: r.rating,
    content: r.content,
    created_at: r.created_at,
    color: r.color_name || '',
    product_name: r.product_name,
    media: (r.medias || '').split('|').filter(Boolean),
    user_login: r.user_login,   // ✅ 생 아이디
    user_mask: mask             // ✅ 마스킹 아이디
  }
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'서버 오류' });
  }
});


module.exports = router;