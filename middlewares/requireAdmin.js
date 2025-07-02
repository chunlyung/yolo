// middlewares/requireAdmin.js
module.exports = (req, res, next) => {
  const admin = req.session.admin;   // ✅ 너는 adminAuth.js에서 세션을 이렇게 저장하고 있음
  if (admin && admin.id) return next();
  res.status(403).send('관리자만 접근 가능합니다');
};