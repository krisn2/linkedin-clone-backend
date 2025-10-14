const jwt = require('jsonwebtoken');
const User = require('../models/User');


exports.authenticate = async (req, res, next) => {
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
const token = authHeader.split(' ')[1];
try {
const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
req.user = await User.findById(payload.id).select('-password');
if (!req.user) return res.status(401).json({ error: 'User not found' });
next();
} catch (err) {
return res.status(401).json({ error: 'Invalid token' });
}
};