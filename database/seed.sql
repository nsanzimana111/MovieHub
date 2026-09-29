USE moviehub_db;

INSERT INTO users (role_id, full_name, email, password_hash, phone, status) VALUES
(1, 'System Administrator', 'admin@moviehub.local', '$2a$10$mXbYHLxM2WQTEUre8u05ROOTWLvPk5mkADdYOklsamlo46bjEvV2q', '+250788000001', 'active'),
(2, 'John Viewer', 'user1@moviehub.local', '$2a$10$6K7L/3xV4Ql8pF2uL7L11O5h4KfGdYhT0fV2N2rM6kVxqfA0Gk5yW', '+250788000002', 'active');

INSERT INTO payment_settings (provider_name, payment_phone_number, account_name, instructions, currency, is_active, updated_by) VALUES
('MTN Mobile Money', '+250788123456', 'MovieHub Sales', 'Send the exact amount to the number above and then submit the transaction reference.', 'RWF', TRUE, 1);

INSERT INTO movies (
  category_id,
  uploaded_by,
  title,
  slug,
  description,
  genre,
  release_year,
  duration_minutes,
  language,
  country,
  poster_path,
  movie_file_path,
  movie_file_size,
  movie_file_mime_type,
  price_rwf,
  status
) VALUES
(1, 1, 'The Last Patrol', 'the-last-patrol', 'A tactical team races against time to stop a city-wide cyber attack.', 'Action', 2024, 118, 'English', 'Rwanda', '/uploads/posters/default-1.jpg', '/uploads/movies/demo-1.mp4', 25000000, 'video/mp4', 2500.00, 'published'),
(2, 1, 'Midnight Bloom', 'midnight-bloom', 'A young woman returns home to uncover the truth behind her family story.', 'Drama', 2023, 101, 'English', 'Rwanda', '/uploads/posters/default-2.jpg', '/uploads/movies/demo-2.mp4', 22000000, 'video/mp4', 1800.00, 'published'),
(3, 1, 'Laughing in the Rain', 'laughing-in-the-rain', 'A comedy about friendship, second chances, and a surprise music festival.', 'Comedy', 2022, 96, 'English', 'Kenya', '/uploads/posters/default-3.jpg', '/uploads/movies/demo-3.mp4', 21000000, 'video/mp4', 1700.00, 'published');

INSERT INTO payment_orders (user_id, movie_id, order_reference, amount_rwf, currency, status, expires_at) VALUES
(2, 1, 'MH-ORD-1001', 2500.00, 'RWF', 'submitted', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(2, 2, 'MH-ORD-1002', 1800.00, 'RWF', 'submitted', DATE_ADD(NOW(), INTERVAL 24 HOUR));

INSERT INTO payment_submissions (payment_order_id, user_id, transaction_reference, sender_phone, submitted_amount_rwf, notes, status) VALUES
(1, 2, 'MM-REF-001', '+250788000002', 2500.00, 'Payment sent via MTN MoMo', 'pending'),
(2, 2, 'MM-REF-002', '+250788000002', 1800.00, 'Second transaction reference', 'pending');

SELECT 'MovieHub seed data loaded successfully.' AS status;
