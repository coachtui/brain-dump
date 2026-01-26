// Run this in Expo to clear stored credentials
// Instructions: 
// 1. Close your app completely
// 2. Shake device to open dev menu
// 3. Choose "Debug Remote JS"
// 4. In browser console, run the deleteItemAsync commands

import * as SecureStore from 'expo-secure-store';

async function clearAuth() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  console.log('✅ Cleared stored tokens');
}

// Or just reinstall the app from Expo Go
