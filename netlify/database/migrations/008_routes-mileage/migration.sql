-- A driver's route for a day: when it started and ended, the odometer readings (the mileage log),
-- the planned distance and time from the route planner, and the stops in driving order. The
-- app's own mileage = the legs to the stops actually delivered (+ the way back once the route ends).
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  driver_email TEXT NOT NULL,
  day DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  start_odometer INT,                       -- km, as typed by the driver (optional)
  end_odometer INT,
  planned_meters INT,                       -- from the route planner, when connected
  planned_seconds INT,
  stops JSONB NOT NULL DEFAULT '[]',        -- order refs in driving order
  legs JSONB NOT NULL DEFAULT '[]',         -- [{ ref, meters, seconds }]: the drive to each stop, from the planner
  return_meters INT,                        -- the drive back to the shop at the end
  start_label TEXT,                         -- "Shop" or "My location"
  note TEXT
);
CREATE INDEX routes_driver_day_idx ON routes (driver_email, day);

-- Each order's place in its route (1, 2, 3…), so the app and the desk show the same order.
ALTER TABLE orders ADD COLUMN route_seq INT;
