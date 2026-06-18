const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const username = process.env.INITIAL_ADMIN_USERNAME || 'admin';
      const rawPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
      
      console.log(`[Seed] No users found in database. Initializing first superuser account "${username}"...`);
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(rawPassword, salt);
      
      await User.create({
        username: username.toLowerCase(),
        password: hashedPassword,
        role: 'superuser'
      });
      
      console.log(`[Seed] First Super User account "${username}" created successfully.`);
      console.log(`[Seed] IMPORTANT: Change the initial password immediately in production.`);
    } else {
      console.log('[Seed] User database already populated. Seeding skipped.');
    }
  } catch (error) {
    console.error('[Seed] Error during admin seeding:', error.message);
  }
}

module.exports = seedAdmin;
