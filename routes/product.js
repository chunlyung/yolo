// routes/product.js
const express = require('express');
const router = express.Router();
const getConnection = require('../db'); // DB 연결

router.get('/:id', async (req, res) => {
  const db = await getConnection();
  const id = Number(req.params.id); // products.id

  try {
    // 1) 상품
    const [[product]] = await db.query(`
      SELECT
        id, name, \`option\`, color, price, sale_price, thumb, is_new,
        size_info, description_html,
        detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4,
        detail_img5, detail_img6, detail_img7, detail_img8,
        hover_img1, hover_img2, hover_img_list,
        color_title1, color_img1, color_desc1,
        color_title2, color_img2, color_desc2
      FROM products
      WHERE id = ?`,
      [id]
    );
    if (!product) return res.status(404).send('상품을 찾을 수 없습니다.');

    // 2) 옵션(색상/가격/썸네일)
    const [options] = await db.query(
      `SELECT color, price, sale_price, thumb, stock
       FROM products_option
       WHERE product_id = ?`,
      [id]
    );

    // 3) 리뷰 + 작성자 + 주문옵션컬러 + 첨부 미디어
    //  - medias: url을 '|'로 합침, types: 타입(image|video)
    const [rows] = await db.query(
      `SELECT
          r.id, r.user_id, r.product_id, r.order_item_id,
          r.rating, r.title, r.content, r.created_at,
          y.userid AS reviewer,              -- 또는 y.name
          oi.color AS color_name,
          GROUP_CONCAT(m.media_url  ORDER BY m.sort_no SEPARATOR '|') AS medias,
          GROUP_CONCAT(m.media_type ORDER BY m.sort_no SEPARATOR '|') AS media_types
       FROM reviews r
       JOIN yolos y           ON y.id  = r.user_id
       LEFT JOIN order_items oi ON oi.id = r.order_item_id
       LEFT JOIN review_media m  ON m.review_id = r.id
       WHERE r.product_id = ? AND r.is_hidden = 0
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [id]
    );

   // === reviews 라우터 파일 맨 위쪽(또는 rows.map 바로 위) ===
const maskShow3 = (v) => {
  const raw  = v == null ? '' : String(v).trim();
  if (!raw) return '';
  const base = raw.includes('@') ? raw.split('@')[0] : raw; // 이메일이면 @ 앞부분만
  const arr  = Array.from(base);
  const keep = Math.min(3, arr.length);
  return arr.slice(0, keep).join('') + '*'.repeat(arr.length - keep);
};



    // 3-1) EJS가 쓰기 좋게 가공
    const reviews = rows.map(r => {
      const media = [];
      if (r.medias) {
        const urls  = r.medias.split('|');
        const types = (r.media_types || '').split('|');
        for (let i = 0; i < urls.length; i++) {
          media.push({ url: urls[i], type: types[i] || 'image' });
        }
      }
      return {
        id: r.id,
        user_id: r.user_id,
        user_mask: maskShow3(r.reviewer || r.user_id),
        product_id: r.product_id,
        order_item_id: r.order_item_id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        created_at: r.created_at,
        color_name: r.color_name || null,
        // 내가 준 EJS는 url 배열만 사용하므로 아래 한 줄이면 충분
        media: media.map(m => m.url)
      };
    });

    // 4) 평균/개수 (캐시 컬럼이 없다면 계산)
    const [[stats]] = await db.query(
      `SELECT ROUND(AVG(rating),2) AS avgRating, COUNT(*) AS reviewCount
       FROM reviews
       WHERE product_id=? AND is_hidden=0`,
      [id]
    );

    res.render('product-detail', {
      product,
      options,
      reviews,
      avgRating: Number(stats?.avgRating || 0),
      reviewCount: Number(stats?.reviewCount || 0),
    });
  } catch (err) {
    console.error('❌ 상품 상세 조회 오류:', err);
    res.status(500).send('서버 오류');
  }
});

module.exports = router;