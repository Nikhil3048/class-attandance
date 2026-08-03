const { supabaseAdmin } = require('../config/supabase');

// Fast in-memory session cache (TTL: 60 seconds)
const sessionCache = new Map();
const CACHE_TTL = 60 * 1000;

function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Middleware to verify JWT token from Supabase Auth
 * Attaches user and role info to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Check fast in-memory session cache
    const cached = sessionCache.get(token);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      req.user = cached.user;
      return next();
    }

    // Fast local JWT expiry check
    const payload = parseJwt(token);
    if (payload && payload.exp && (payload.exp * 1000 < Date.now())) {
      return res.status(401).json({ error: 'Token expired' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch role from users table
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // 1. Try finding existing user by email (e.g. if pre-created by admin)
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role')
        .eq('email', user.email)
        .single();

      if (existingUser) {
        // Link Google Auth ID to the existing profile
        await supabaseAdmin
          .from('users')
          .update({ id: user.id })
          .eq('email', user.email);
        profile = { ...existingUser, id: user.id };
      } else {
        // 2. Auto-provision profile in public.users table for new Google OAuth user
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            id: user.id,
            name: userName,
            email: user.email,
            role: 'student'
          })
          .select('id, name, email, role')
          .single();

        if (createError) {
          console.error('Failed to auto-create OAuth user profile:', createError);
          return res.status(403).json({ error: 'User profile not found' });
        }
        profile = newProfile;
      }
    }

    const fullUser = { ...user, ...profile };
    req.user = fullUser;

    // Cache session for fast subsequent requests
    sessionCache.set(token, { user: fullUser, timestamp: Date.now() });
    if (sessionCache.size > 1000) {
      const oldestKey = sessionCache.keys().next().value;
      sessionCache.delete(oldestKey);
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Role-check middleware factory
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
