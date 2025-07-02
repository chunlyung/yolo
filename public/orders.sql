CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_price INT NOT NULL,
  postcode VARCHAR(20),
  address VARCHAR(255),
  address_detail VARCHAR(255),
  request_memo TEXT,
  status VARCHAR(20) DEFAULT '결제완료' -- 또는 '배송준비중'
);
