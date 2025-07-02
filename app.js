const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const app =express();
const port =3000;
const path =require('path');
const getConnection = require('./db');
const MySQLStore=require('express-mysql-session')(session);
const axios = require("axios");
const nodemailer = require('nodemailer');


app.use(session({
  secret: '232300',
  resave: false,
  saveUninitialized: false , // 빈 세션 저장 안함 
  store: new MySQLStore({
    host:'localhost',
    port:3306,
    user:'root',
    password:'111111',
    database:'yolos'
  }),
  cookie: {
    httpOnly:true,
    secureL:false,
     maxAge: 1000 * 60 * 60 * 5// 5시간 유지
  }
 
}));
app.set('view engine','ejs');
app.set('views',
  path.join(__dirname,'views'));




app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));



const loginRouter = require('./routes/server');
const signupRouter = require('./routes/signup');
const cartRouter= require('./routes/cart');
const mypageRouter = require('./routes/mypage');
const logoutRouter = require('./routes/logout');
const purchaseRouter =require('./routes/purchase');
const orderRouter = require('./routes/order');
const adminAuth=require('./routes/adminAuth');
const adminRouter=require('./routes/admin');
const productsRouter =require('./routes/products');
const productRouter =require('./routes/product');
const shopAllRouter=require('./routes/shopAll');
const searchRouter = require('./routes/search');
const paymentRouter =require('./routes/payment');
const passwordRouter=require('./routes/password');
const shopRouter= require('./routes/shop');

app.use('/',loginRouter);
app.use('/',signupRouter);
app.use('/mypage',mypageRouter);
app.use('/',logoutRouter);
app.use('/cart',cartRouter);
app.use('/purchase',purchaseRouter);
app.use('/order',orderRouter);
app.use('/admin',adminAuth);
app.use('/admin',adminRouter);
app.use('/products',productsRouter);
app.use('/product',productRouter);
app.use('/shop-all',shopAllRouter);
app.use('/search',searchRouter);
app.use('/payment',paymentRouter);
app.use('/',passwordRouter);
app.use('/shop',shopRouter);

app.use(express.static(path.join(__dirname,'public')));



app.get('/',(req,res)=>{
  res.send('접속성공');
});

console.log('서버 라우터들 정상 등록 완료');

app.listen(port,'0.0.0.0');

