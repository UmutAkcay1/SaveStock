-- SaveStock için 50 örnek ürün, her ürün için stok lotu ve SKT.
-- pgAdmin'de savestock veritabanının Query Tool penceresinde çalıştırın.
-- DEMO- ile başlayan kayıtlar tekrar çalıştırıldığında çoğaltılmaz.

BEGIN;

CREATE TEMP TABLE savestock_demo_seed (
    sku VARCHAR(64) PRIMARY KEY,
    product_name VARCHAR(160) NOT NULL,
    category_name VARCHAR(80) NOT NULL,
    unit VARCHAR(24) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expiry_date DATE NOT NULL
) ON COMMIT DROP;

INSERT INTO categories (name) VALUES
    ('Gıda'), ('İçecek'), ('Kahvaltılık'), ('Atıştırmalık'), ('Bakliyat'),
    ('Takviye'), ('Kişisel Bakım'), ('İlaç & Sağlık'), ('Temizlik'), ('Baharat')
ON CONFLICT (name) DO NOTHING;

INSERT INTO savestock_demo_seed (sku, product_name, category_name, unit, quantity, expiry_date) VALUES
('DEMO-001', 'Tam Buğday Ekmeği', 'Gıda', 'adet', 24, DATE '2026-10-01'),
('DEMO-002', 'Süt 1 L', 'İçecek', 'şişe', 36, DATE '2026-10-08'),
('DEMO-003', 'Yoğurt 1 kg', 'Kahvaltılık', 'kutu', 18, DATE '2026-10-10'),
('DEMO-004', 'Taze Kaşar 500 g', 'Kahvaltılık', 'paket', 22, DATE '2026-09-28'),
('DEMO-005', 'Ayran 1 L', 'İçecek', 'şişe', 30, DATE '2026-10-15'),
('DEMO-006', 'Kefir 1 L', 'İçecek', 'şişe', 16, DATE '2026-10-18'),
('DEMO-007', 'Labne 400 g', 'Kahvaltılık', 'kutu', 21, DATE '2026-10-22'),
('DEMO-008', 'Tavuk Suyu Çorba', 'Gıda', 'paket', 40, DATE '2026-10-27'),
('DEMO-009', 'Meyveli Yoğurt 4''lü', 'Kahvaltılık', 'paket', 19, DATE '2026-11-02'),
('DEMO-010', 'Portakal Suyu 1 L', 'İçecek', 'şişe', 28, DATE '2026-11-08'),
('DEMO-011', 'Yumurta 15''li', 'Kahvaltılık', 'kutu', 32, DATE '2026-11-12'),
('DEMO-012', 'Tereyağı 250 g', 'Kahvaltılık', 'paket', 14, DATE '2026-11-18'),
('DEMO-013', 'Beyaz Peynir 500 g', 'Kahvaltılık', 'paket', 20, DATE '2026-11-24'),
('DEMO-014', 'Hindi Füme 150 g', 'Gıda', 'paket', 17, DATE '2026-11-29'),
('DEMO-015', 'Krema 200 ml', 'Kahvaltılık', 'kutu', 25, DATE '2026-12-04'),
('DEMO-016', 'Makarna 500 g', 'Gıda', 'paket', 60, DATE '2026-12-10'),
('DEMO-017', 'Pirinç 1 kg', 'Bakliyat', 'paket', 45, DATE '2026-12-15'),
('DEMO-018', 'Kırmızı Mercimek 1 kg', 'Bakliyat', 'paket', 38, DATE '2026-12-20'),
('DEMO-019', 'Nohut 1 kg', 'Bakliyat', 'paket', 27, DATE '2026-12-26'),
('DEMO-020', 'Kuru Fasulye 1 kg', 'Bakliyat', 'paket', 31, DATE '2027-01-03'),
('DEMO-021', 'Domates Salçası 700 g', 'Gıda', 'kavanoz', 23, DATE '2027-01-10'),
('DEMO-022', 'Zeytinyağı 1 L', 'Gıda', 'şişe', 15, DATE '2027-01-18'),
('DEMO-023', 'Bal 450 g', 'Kahvaltılık', 'kavanoz', 12, DATE '2027-01-25'),
('DEMO-024', 'Çilek Reçeli 380 g', 'Kahvaltılık', 'kavanoz', 18, DATE '2027-02-02'),
('DEMO-025', 'Tahin 600 g', 'Kahvaltılık', 'kavanoz', 16, DATE '2027-02-10'),
('DEMO-026', 'Yulaf Ezmesi 500 g', 'Gıda', 'paket', 35, DATE '2027-02-18'),
('DEMO-027', 'Mısır Gevreği 350 g', 'Kahvaltılık', 'kutu', 29, DATE '2027-02-26'),
('DEMO-028', 'Bitter Çikolata 80 g', 'Atıştırmalık', 'adet', 50, DATE '2027-03-05'),
('DEMO-029', 'Bisküvi 300 g', 'Atıştırmalık', 'paket', 42, DATE '2027-03-12'),
('DEMO-030', 'Kuru Kayısı 250 g', 'Atıştırmalık', 'paket', 26, DATE '2027-03-20'),
('DEMO-031', 'Filtre Kahve 250 g', 'İçecek', 'paket', 21, DATE '2027-04-01'),
('DEMO-032', 'Türk Kahvesi 100 g', 'İçecek', 'paket', 34, DATE '2027-04-10'),
('DEMO-033', 'Siyah Çay 500 g', 'İçecek', 'paket', 28, DATE '2027-04-18'),
('DEMO-034', 'Maden Suyu 6''lı', 'İçecek', 'paket', 20, DATE '2027-04-26'),
('DEMO-035', 'Ton Balığı 160 g', 'Gıda', 'konserve', 24, DATE '2027-05-04'),
('DEMO-036', 'Bezelye Konservesi 400 g', 'Gıda', 'konserve', 19, DATE '2027-05-12'),
('DEMO-037', 'Ketçap 450 g', 'Gıda', 'şişe', 13, DATE '2027-05-20'),
('DEMO-038', 'Mayonez 330 g', 'Gıda', 'şişe', 15, DATE '2027-05-28'),
('DEMO-039', 'Kekik 40 g', 'Baharat', 'paket', 37, DATE '2027-06-05'),
('DEMO-040', 'Karabiber 50 g', 'Baharat', 'paket', 33, DATE '2027-06-14'),
('DEMO-041', 'C Vitamini 1000 mg', 'Takviye', 'kutu', 20, DATE '2027-06-22'),
('DEMO-042', 'D3 Vitamini 1000 IU', 'Takviye', 'kutu', 18, DATE '2027-07-01'),
('DEMO-043', 'Omega 3 1000 mg', 'Takviye', 'kutu', 16, DATE '2027-07-10'),
('DEMO-044', 'Magnezyum 250 mg', 'Takviye', 'kutu', 22, DATE '2027-07-18'),
('DEMO-045', 'Protein Tozu 500 g', 'Takviye', 'kutu', 11, DATE '2027-08-01'),
('DEMO-046', 'El Kremi 75 ml', 'Kişisel Bakım', 'tüp', 25, DATE '2027-08-12'),
('DEMO-047', 'Şampuan 400 ml', 'Kişisel Bakım', 'şişe', 14, DATE '2027-08-24'),
('DEMO-048', 'Güneş Kremi SPF 50', 'Kişisel Bakım', 'tüp', 12, DATE '2027-09-05'),
('DEMO-049', 'Yara Bandı 20''li', 'İlaç & Sağlık', 'kutu', 40, DATE '2027-09-18'),
('DEMO-050', 'Sıvı Sabun 500 ml', 'Temizlik', 'şişe', 23, DATE '2027-10-01');

INSERT INTO products (sku, name, unit, category_id, created_at)
SELECT s.sku, s.product_name, s.unit, c.id, CURRENT_TIMESTAMP
FROM savestock_demo_seed AS s
JOIN categories AS c ON c.name = s.category_name
ON CONFLICT (sku) DO NOTHING;

INSERT INTO batches (product_id, dealer_id, batch_code, expiry_date, quantity_on_hand)
SELECT p.id, d.id, 'LOT-' || s.sku, s.expiry_date, s.quantity
FROM savestock_demo_seed AS s
JOIN products AS p ON p.sku = s.sku
CROSS JOIN dealers AS d
WHERE d.name = 'Merkez Depo'
ON CONFLICT (product_id, dealer_id, batch_code) DO NOTHING;

INSERT INTO stock_movements (batch_id, movement_type, quantity, note, created_at)
SELECT b.id, 'IN', b.quantity_on_hand, 'SaveStock örnek başlangıç stoğu', CURRENT_TIMESTAMP
FROM savestock_demo_seed AS s
JOIN products AS p ON p.sku = s.sku
CROSS JOIN dealers AS d
JOIN batches AS b ON b.product_id = p.id AND b.dealer_id = d.id AND b.batch_code = 'LOT-' || s.sku
WHERE d.name = 'Merkez Depo'
  AND NOT EXISTS (
    SELECT 1
    FROM stock_movements AS m
    WHERE m.batch_id = b.id
      AND m.movement_type = 'IN'
      AND m.note = 'SaveStock örnek başlangıç stoğu'
);

COMMIT;

-- İşlem sonrası bu sorgunun sonuçlarında DEMO-001 ile DEMO-050 arasını görmelisiniz.
SELECT p.sku AS "Stok Kodu", p.name AS "Ürün", c.name AS "Kategori",
       b.quantity_on_hand AS "Stok", p.unit AS "Birim", b.batch_code AS "Lot",
       b.expiry_date AS "SKT"
FROM products AS p
JOIN categories AS c ON c.id = p.category_id
JOIN batches AS b ON b.product_id = p.id AND b.batch_code = 'LOT-' || p.sku
JOIN dealers AS d ON d.id = b.dealer_id AND d.name = 'Merkez Depo'
WHERE p.sku LIKE 'DEMO-%'
ORDER BY p.sku;
