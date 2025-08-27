const express = require('express');
const router =express.Router();

router.get('/logout',(req,res) =>
{ 
    console.log('요청들어옴');
  req.session.destroy((err)=> {
    if(err){
        console.error('로그아웃 실패:',err);
    return res.status(500),send('로그아웃 실패');

    }
    res.clearCookie('connect.sid');
    res.redirect('/login');


  });
});



module.exports = router;

