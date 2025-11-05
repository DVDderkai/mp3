const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const User = require('../models/user');

function safeParse(obj, fallback = {}) {
  try { return obj ? JSON.parse(obj) : fallback; } catch { return fallback; }
}
function getFilter(q) {
  return safeParse(q.where, safeParse(q.filter, {}));
}
function toInt(x) { const n = parseInt(x); return Number.isNaN(n) ? undefined : n; }

router.get('/', async (req, res) => {
  try {
    let query = Task.find(getFilter(req.query));
    const sort   = safeParse(req.query.sort);
    const select = safeParse(req.query.select);
    const skip   = toInt(req.query.skip);
    const limit  = toInt(req.query.limit);

    if (Object.keys(sort).length)   query = query.sort(sort);
    if (Object.keys(select).length) query = query.select(select);
    if (skip !== undefined)         query = query.skip(skip);
    // tasks 默认 limit=100
    query = query.limit(limit === undefined ? 100 : limit);

    const isCount = String(req.query.count).toLowerCase() === 'true';
    const result  = isCount ? await query.countDocuments() : await query;
    res.status(200).json({ message: 'OK', data: result });
  } catch (err) {
    res.status(400).json({ message: 'Query Error', data: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Task.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Task not found', data: {} });
    res.status(200).json({ message: 'OK', data: doc });
  } catch (err) {
    res.status(400).json({ message: 'Error', data: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.name || !req.body.deadline) {
      return res.status(400).json({ message: 'Name and deadline required', data: {} });
    }
    const created = await Task.create(req.body);

    if (created.assignedUser && !created.completed) {
      await User.updateOne(
        { _id: created.assignedUser },
        { $addToSet: { pendingTasks: String(created._id) } }
      );
    }

    res.status(201).json({ message: 'Task created', data: created });
  } catch (err) {
    res.status(400).json({ message: 'Task creation failed', data: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) return res.status(404).json({ message: 'Task not found', data: {} });

    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (oldTask.assignedUser && (!updated.assignedUser || updated.assignedUser !== oldTask.assignedUser)) {
      await User.updateOne(
        { _id: oldTask.assignedUser },
        { $pull: { pendingTasks: String(oldTask._id) } }
      );
    }
    if (updated.assignedUser && !updated.completed) {
      await User.updateOne(
        { _id: updated.assignedUser },
        { $addToSet: { pendingTasks: String(updated._id) } }
      );
    }

    res.status(200).json({ message: 'Task updated', data: updated });
  } catch (err) {
    res.status(400).json({ message: 'Update failed', data: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Task not found', data: {} });

    if (deleted.assignedUser) {
      await User.updateOne(
        { _id: deleted.assignedUser },
        { $pull: { pendingTasks: String(deleted._id) } }
      );
    }

    res.status(204).json({ message: 'Task deleted', data: {} });
  } catch (err) {
    res.status(400).json({ message: 'Delete failed', data: err.message });
  }
});

module.exports = router;
