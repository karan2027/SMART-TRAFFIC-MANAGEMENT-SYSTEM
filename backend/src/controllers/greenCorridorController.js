const DBStore = require('../services/dbStore');

// Graph adjacency representation for local routing network
const JUNCTION_GRAPH = {
  JUNC001: [
    { destination: 'JUNC002', roadId: 'ROAD_E01', travelTimeSeconds: 120, distanceMeters: 1400 },
    { destination: 'JUNC003', roadId: 'ROAD_N01', travelTimeSeconds: 180, distanceMeters: 2100 }
  ],
  JUNC002: [
    { destination: 'JUNC001', roadId: 'ROAD_W02', travelTimeSeconds: 120, distanceMeters: 1400 },
    { destination: 'JUNC004', roadId: 'ROAD_E02', travelTimeSeconds: 150, distanceMeters: 1800 }
  ],
  JUNC003: [
    { destination: 'JUNC001', roadId: 'ROAD_S01', travelTimeSeconds: 180, distanceMeters: 2100 },
    { destination: 'JUNC004', roadId: 'ROAD_E03', travelTimeSeconds: 210, distanceMeters: 2500 }
  ],
  JUNC004: [
    { destination: 'JUNC002', roadId: 'ROAD_W04', travelTimeSeconds: 150, distanceMeters: 1800 },
    { destination: 'JUNC003', roadId: 'ROAD_W03', travelTimeSeconds: 210, distanceMeters: 2500 }
  ]
};

// Dijkstra shortest path
function calculateOptimalRoute(start, end) {
  const distances = {};
  const previous = {};
  const roadUsed = {};
  const unvisited = new Set(Object.keys(JUNCTION_GRAPH));

  for (const node of unvisited) {
    distances[node] = Infinity;
  }
  distances[start] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let shortest = Infinity;
    for (const node of unvisited) {
      if (distances[node] < shortest) {
        shortest = distances[node];
        current = node;
      }
    }

    if (!current || shortest === Infinity) break;
    if (current === end) break;

    unvisited.delete(current);

    const neighbors = JUNCTION_GRAPH[current] || [];
    for (const edge of neighbors) {
      if (!unvisited.has(edge.destination)) continue;
      const alt = distances[current] + edge.travelTimeSeconds;
      if (alt < distances[edge.destination]) {
        distances[edge.destination] = alt;
        previous[edge.destination] = current;
        roadUsed[edge.destination] = edge.roadId;
      }
    }
  }

  // Reconstruct path
  const path = [];
  const roads = [];
  let curr = end;
  while (curr) {
    path.unshift(curr);
    if (roadUsed[curr]) roads.unshift(roadUsed[curr]);
    curr = previous[curr];
  }

  return {
    path: path.length > 1 ? path : [start, end],
    roads: roads.length > 0 ? roads : ['ROAD_E01'],
    totalTravelTimeSeconds: distances[end] !== Infinity ? distances[end] : 120
  };
}

// GET /api/corridors - List active & past green wave corridors
exports.getCorridors = async (req, res, next) => {
  try {
    const { status } = req.query;
    const corridors = await DBStore.getCorridors({ status });
    res.json({ success: true, count: corridors.length, data: corridors });
  } catch (err) {
    next(err);
  }
};

// POST /api/corridors/plan - Calculate optimal route between two junctions
exports.planRoute = async (req, res, next) => {
  try {
    const { startJunctionId = 'JUNC001', destinationJunctionId = 'JUNC002' } = req.body;
    const start = startJunctionId.toUpperCase();
    const dest = destinationJunctionId.toUpperCase();

    const route = calculateOptimalRoute(start, dest);
    res.json({
      success: true,
      data: {
        startJunctionId: start,
        destinationJunctionId: dest,
        routeJunctions: route.path,
        routeRoads: route.roads,
        estimatedTravelTimeSeconds: route.totalTravelTimeSeconds,
        estimatedTimeSavedSeconds: Math.round(route.totalTravelTimeSeconds * 0.45) // 45% delay reduction
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/corridors/activate - Activate green wave corridor along route
exports.activateCorridor = async (req, res, next) => {
  try {
    const {
      emergencyType = 'AMBULANCE',
      vehicleIdentifier = 'AMB-METRO-01',
      startJunctionId = 'JUNC001',
      destinationJunctionId = 'JUNC002'
    } = req.body;

    const start = startJunctionId.toUpperCase();
    const dest = destinationJunctionId.toUpperCase();
    const route = calculateOptimalRoute(start, dest);

    const corridor = await DBStore.createCorridor({
      emergencyType,
      vehicleIdentifier,
      startJunctionId: start,
      destinationJunctionId: dest,
      routeJunctions: route.path,
      routeRoads: route.roads,
      estimatedTravelTimeSeconds: route.totalTravelTimeSeconds,
      timeSavedSeconds: Math.round(route.totalTravelTimeSeconds * 0.45),
      junctionSteps: route.path.map((jId, idx) => ({
        junctionId: jId,
        incomingApproach: idx === 0 ? 'SOUTH' : 'WEST',
        outgoingApproach: 'EAST',
        clearedAt: null,
        preemptionActive: idx === 0
      }))
    });

    // Automatically trigger emergency pre-emption on first junction
    await DBStore.setEmergencyOverride(start, {
      approach: 'SOUTH',
      vehicleType: emergencyType,
      triggeredBy: 'GREEN_CORRIDOR_SYSTEM'
    });

    res.status(201).json({
      success: true,
      message: `🚑 Green Corridor activated along route [${route.path.join(' -> ')}]`,
      data: corridor
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/corridors/:corridorId/advance - Progress emergency vehicle to next junction
exports.advanceCorridor = async (req, res, next) => {
  try {
    const { corridorId } = req.params;
    const corridor = await DBStore.getCorridorById(corridorId);
    if (!corridor) {
      return res.status(404).json({ success: false, message: `Corridor ${corridorId} not found` });
    }

    const currentJunc = corridor.routeJunctions[corridor.currentJunctionIndex];
    // Release priority on passed junction
    if (currentJunc) {
      await DBStore.clearEmergencyOverride(currentJunc);
    }

    const updated = await DBStore.advanceCorridor(corridorId);

    // If corridor still has remaining junctions, engage pre-emption on next
    if (updated.status === 'ACTIVE' && updated.currentJunctionIndex < updated.routeJunctions.length) {
      const nextJunc = updated.routeJunctions[updated.currentJunctionIndex];
      await DBStore.setEmergencyOverride(nextJunc, {
        approach: 'WEST',
        vehicleType: updated.emergencyType,
        triggeredBy: 'GREEN_CORRIDOR_SYSTEM'
      });
    }

    res.json({
      success: true,
      message: updated.status === 'COMPLETED'
        ? `🏁 Green Corridor ${corridorId} completed. All junctions restored to normal control.`
        : `Progressed to junction ${updated.routeJunctions[updated.currentJunctionIndex]}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
