require('dotenv').config();

console.log('DB USER',process.env.DB_USER);

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
  saveUninitialized: false , 
  store: new MySQLStore({
    host:process.env.DB_HOST,
    port:process.env.DB_PORT,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    timezone:'+09:00'
  }),
  cookie: {
    httpOnly:true,
    secureL:false,
     maxAge: 1000 * 60 * 60 * 5
  }
 
}));
app.set('view engine','ejs');
app.set('views',
  path.join(__dirname,'views'));




app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  const u = req.session.user || null;
  res.locals.user = u;     
  next();
});


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
const reviewsRouter = require('./routes/reviews');

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
app.use('/reviews', reviewsRouter);



app.get('/about-as',(req,res)=> {
  res.render('about-as', { user: req.session.user });
});

app.get('/store',(req,res)=> {
  res.render('store', { user: req.session.user });
});

app.get('/contact',(req,res)=> {
  res.render('contact', { user: req.session.user });
});

app.get('/notice',(req,res)=> {
  res.render('notice', { user: req.session.user });
});

app.get('/login',(req,res)=> {
  res.render('login', { user: req.session.user });
});
app.get('/question',(req,res)=> {
  res.render('question', { user: req.session.user });
});
app.get('/QNA',(req,res)=> {
  res.render('QNA', { user: req.session.user });
});


app.get('/signup',(req,res)=> {
  res.render('signup', { user: req.session.user });
});

app.get('/policy',(req,res)=> {
  res.render('policy', { user: req.session.user });
});

app.get('/privacy',(req,res)=> {
  res.render('privacy', { user: req.session.user });
});
app.get('/notice-detail',(req,res)=>{
  res.render('notice-detail', { user: req.session.user });
});
app.get('/faq-detail',(req,res)=>{
  res.render('faq-detail', { user: req.session.user });
});


app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

app.get("/shop-all", (req, res) => {
  res.render("/shop-all", { user: req.session.user });
});


app.use(express.static(path.join(__dirname,'public')));


console.log('서버 라우터들 정상 등록 완료');

app.listen(port,'0.0.0.0');

