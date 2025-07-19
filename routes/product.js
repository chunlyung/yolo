const express = require('express');
const router = express.Router();
const getConnection
 = require('../db'); // DB 연결

router.get('/:id', async (req, res) => {
  const db = await getConnection();
  const id = req.params.id;

  try {
    // 상품 기본 정보
    const [[product]] = await db.query(`SELECT
    id, name, \`option\`, color, price, thumb,
    size_info, description_html,
    detail_subtitle, detail_img1, detail_img2, detail_img3, detail_img4,
    detail_img5, detail_img6, detail_img7, detail_img8,
     hover_img1, hover_img2, hover_img_list,
    color_title1, color_img1, color_desc1,
    color_title2, color_img2, color_desc2
  FROM products
  WHERE id = ?`, [id]);
    if (!product) return res.status(404).send('상품을 찾을 수 없습니다.');

    // 옵션(색상, 가격, 썸네일) 정보
    const [options] = await db.query(`
      SELECT color, price, thumb, stock FROM products_option WHERE product_id = ?
    `, [id]);

    res.render('product-detail', {
      product,
      options
    });
  } catch (err) {
    console.error('❌ 상품 상세 조회 오류:', err);
    res.status(500).send('서버 오류');
  }
});


module.exports = router;
