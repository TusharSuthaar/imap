const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'epm-crm-super-secret-key-change-in-prod';

/**
 * Middleware to verify JWT token and inject user_id into req.user
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    // Attach the user object (id, email) to the request
    req.user = decoded;
    next();
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valid for 7 days
  );
}

module.exports = {
  verifyToken,
  generateToken,
  JWT_SECRET
};
