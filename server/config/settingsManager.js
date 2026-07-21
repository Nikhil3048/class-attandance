const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('./supabase');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const ENV_FILE = path.join(__dirname, '../../.env');

// Read local JSON settings file
function getLocalSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read settings.json:', err.message);
  }
  return {};
}

// Write local JSON settings file
function saveLocalSettings(settings) {
  try {
    const current = getLocalSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write settings.json:', err.message);
  }
}

// Update .env file with robust line matching
function updateEnvFile(key, value) {
  try {
    if (fs.existsSync(ENV_FILE)) {
      let content = fs.readFileSync(ENV_FILE, 'utf8');
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content = content.trimEnd() + `\n${key}=${value}\n`;
      }
      fs.writeFileSync(ENV_FILE, content, 'utf8');
    }
  } catch (err) {
    console.error('Failed to write to .env:', err.message);
  }
}

/**
 * Get setting value with multi-tier fallback:
 * 1. Supabase settings table
 * 2. Local settings.json file
 * 3. process.env
 * 4. defaultValue
 */
async function getSetting(key, defaultValue = '') {
  // 1. Try DB
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (!error && data && data.value) {
      return data.value;
    }
  } catch (e) {
    // Ignore DB table error
  }

  // 2. Try local settings.json
  const local = getLocalSettings();
  if (local[key] !== undefined && local[key] !== null && local[key] !== '') {
    return String(local[key]).trim();
  }

  // 3. Try process.env
  const envKey = key.toUpperCase();
  if (process.env[envKey]) {
    return String(process.env[envKey]).trim();
  }

  return String(defaultValue).trim();
}

/**
 * Save setting value across all storage tiers:
 * 1. In-memory (process.env)
 * 2. Local settings.json file
 * 3. .env file
 * 4. Supabase settings table (if present)
 */
async function setSetting(key, value) {
  const envKey = key.toUpperCase();

  // 1. In-memory
  process.env[envKey] = value;

  // 2. Local JSON file
  saveLocalSettings({ [key]: value });

  // 3. .env file
  updateEnvFile(envKey, value);

  // 4. Supabase DB (silent fallback if table doesn't exist)
  try {
    await supabaseAdmin
      .from('settings')
      .upsert({ key, value });
  } catch (e) {
    // Ignore DB table error
  }
}

module.exports = {
  getSetting,
  setSetting
};
