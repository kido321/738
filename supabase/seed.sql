-- Optional: sample items so the Sell screen is not empty on day one.
-- Change names, prices and stock to match your menu (or edit them in the app).
insert into public.products (name, category, price, cost, stock, low_stock_at, track_stock) values
  ('Hennessy VS', 'bottle', 250, 45, 6, 2, true),
  ('Grey Goose', 'bottle', 220, 35, 6, 2, true),
  ('Don Julio 1942', 'bottle', 450, 160, 3, 1, true),
  ('Moet Champagne', 'bottle', 200, 55, 6, 2, true),
  ('Beer', 'drink', 8, 2, 48, 12, true),
  ('Mixed Drink', 'drink', 12, 3, 0, 0, false),
  ('Shot', 'drink', 10, 2, 0, 0, false),
  ('Red Bull', 'drink', 6, 2, 24, 6, true),
  ('Water', 'drink', 3, 0.5, 24, 6, true),
  ('Hookah', 'hookah', 40, 8, 0, 0, false),
  ('Hookah Refill', 'hookah', 20, 4, 0, 0, false),
  ('Table Fee', 'other', 100, 0, 0, 0, false);
