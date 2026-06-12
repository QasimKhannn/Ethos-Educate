require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const { SystemRoles } = require('librechat-data-provider');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

(async () => {
  await connect();

  console.purple('--------------------------');
  console.purple('Promote a user to admin!');
  console.purple('--------------------------');

  let email = process.argv[2];
  if (!email) {
    email = await askQuestion('Email of the user to promote:');
  }

  if (!email || !email.includes('@')) {
    console.red('Error: Invalid email address!');
    silentExit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.red(`Error: No user found with email ${normalizedEmail}`);
    silentExit(1);
  }

  user.role = SystemRoles.ADMIN;
  await user.save();

  console.green(`Success: ${normalizedEmail} is now an admin.`);
  silentExit(0);
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
  }

  if (err.message.includes('fetch failed')) {
    return;
  }

  process.exit(1);
});
