### Phase 2A: Static Map & Sensor Data Pipeline

# Goal: Subscribe to /map, decode binary CDR, and render a static grid to screen.

# Core Deliverables:

* Implement topic subscription infrastructure in core/robot for binary CDR payload handling.
* Subscribe to /map (nav_msgs/msg/OccupancyGrid).
* Pass binary bytes into @foxglove/rosmsg2-serialization using the schema advertised over foxglove_bridge.
* Convert the 1D occupancy array (-1 unknown, 0 free, 100 occupied) into a 2D canvas bitmap.
* Implement basic pan/zoom controls on the map canvas in features/map_view.
* Create mock map generator (VITE_USE_MOCK=true) for fast UI testing.

# Verification / Manual Test:

* Connect to real robot, trigger a map publication, and verify the map matches RViz.
* Confirm resizing or panning the browser canvas does not trigger React re-render loops or leak memory.

### Phase 2B: TF Tree Buffer & Real-Time Robot Pose

# Goal: Stream /tf & /tf_static, compute map → base_link transform, and overlay the robot position on the map.

# Core Deliverables:

* Build a light transform tree/buffer in core/robot/tf (plain TS, out of React state) to cache parent-child transform frames.
* Subscribe to /tf and /tf_static (tf2_msgs/msg/TFMessage).
* Resolve the continuous transform matrix from map $\to$ odom $\to$ base_link (or base_footprint).
* Expose real-time $(x, y, \theta)$ through a ref/snapshot pattern or direct subscription to the canvas animation loop ($\sim$10–30 Hz).
* Draw the robot footprint/heading vector on top of the Phase 1A map canvas.

# Verification / Manual Test:

* Drive the robot with teleop (or physically push it) and verify the robot marker updates smoothly in real time on the web canvas without framerate drops or React state thrashing.
* Verify missing transforms (e.g., TF lookup timeout before map frame exists) fail gracefully without crashing the app shell.