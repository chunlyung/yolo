CREATE TABLE yolos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL,
  name VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phoneNumber VARCHAR(20),
  postcode VARCHAR(20),
  address VARCHAR(255),
  address_detail VARCHAR(255),
  agree_all BOOLEAN DEFAULT false,
  agree_terms BOOLEAN DEFAULT false,
  agree_age BOOLEAN DEFAULT false,
  agree_sms BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);