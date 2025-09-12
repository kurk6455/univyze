const jwt = require('jsonwebtoken');
require('dotenv').config();
const { JWT_SECRETE } = process.env;

// JWT Middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ errors: [{ path: 'auth', message: 'No token provided' }] });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRETE);
        req.userId = decoded.id;
        next();
    } catch (e) {
        console.error('JWT error:', e);
        return res.status(403).json({ errors: [{ path: 'auth', message: 'Invalid token' }] });
    }
};

module.exports = {
    authenticateJWT
};
