const DBStore = require('../services/dbStore');

exports.getRoads = async (req, res, next) => {
  try {
    const roads = await DBStore.getRoads();
    res.json({ success: true, count: roads.length, data: roads });
  } catch (err) {
    next(err);
  }
};

exports.getRoadById = async (req, res, next) => {
  try {
    const road = await DBStore.getRoadById(req.params.roadId);
    if (!road) {
      return res.status(404).json({ success: false, message: `Road not found with ID ${req.params.roadId}`, errorCode: 'ROAD_NOT_FOUND' });
    }
    res.json({ success: true, data: road });
  } catch (err) {
    next(err);
  }
};

exports.createRoad = async (req, res, next) => {
  try {
    const { roadId, name, description, lanes, direction, location } = req.body;
    let road = await DBStore.getRoadById(roadId);
    if (road) {
      return res.status(400).json({ success: false, message: `Road ID ${roadId} already exists`, errorCode: 'DUPLICATE_ROAD' });
    }

    road = await DBStore.createRoad({
      roadId,
      name,
      description,
      lanes: lanes || 2,
      direction: direction || 'Two-Way',
      location
    });

    res.status(201).json({ success: true, data: road });
  } catch (err) {
    next(err);
  }
};
