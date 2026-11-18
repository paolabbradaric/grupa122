// The explicit ESM entrypoint preserves the app factory's CommonJS exports.
import 'express';
import application from './src/app.js';

export default application.createApp();
