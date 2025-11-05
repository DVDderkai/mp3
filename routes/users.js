const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');

function safeParse(obj, fallback = {}) {
  try { return obj ? JSON.parse(obj) : fallback; } catch { return fallback; }
}
function getFilter(q) {
  return safeParse(q.where, safeParse(q.filter, {}));
}
function toInt(x) { const n = parseInt(x); return Number.isNaN(n) ? undefined : n; }

router.get('/', async (req, res) => {
  try {
    let query = User.find(getFilter(req.query));
    const sort   = safeParse(req.query.sort);
    const select = safeParse(req.query.select);
    const skip   = toInt(req.query.skip);
    const limit  = toInt(req.query.limit);

    if (Object.keys(sort).length)   query = query.sort(sort);
    if (Object.keys(select).length) query = query.select(select);
    if (skip !== undefined)         query = query.skip(skip);
    if (limit !== undefined)        query = query.limit(limit);

    const isCount = String(req.query.count).toLowerCase() === 'true';
    const result  = isCount ? await query.countDocuments() : await query;
    res.status(200).json({ message: 'OK', data: result });
  } catch (err) {
    res.status(400).json({ message: 'Query Error', data: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'User not found', data: {} });
    res.status(200).json({ message: 'OK', data: doc });
  } catch (err) {
    res.status(400).json({ message: 'Error', data: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.name || !req.body.email) {
      return res.status(400).json({ message: 'Name and email required', data: {} });
    }
    const created = await User.create(req.body);
    res.status(201).json({ message: 'User created', data: created });
  } catch (err) {
    res.status(400).json({ message: 'User creation failed', data: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'User not found', data: {} });
    res.status(200).json({ message: 'User updated', data: updated });
  } catch (err) {
    res.status(400).json({ message: 'Update failed', data: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found', data: {} });

    await Task.updateMany(
      { assignedUser: req.params.id, completed: false },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );

    res.status(204).json({ message: 'User deleted', data: {} });
  } catch (err) {
    res.status(400).json({ message: 'Delete failed', data: err.message });
  }
});

module.exports = router;
