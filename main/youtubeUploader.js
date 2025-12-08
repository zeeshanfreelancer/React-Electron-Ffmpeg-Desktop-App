const { google } = require('googleapis');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');

// OAuth 2.0 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_PATH = path.join(os.homedir(), '.youtube-uploader-token.json');
const CREDENTIALS_PATH = path.join(os.homedir(), '.youtube-uploader-credentials.json');

let oauth2Client = null;

/**
 * Load or request authorization credentials
 */
async function authorize(credentials, event, ipcMain) {
  // Support both installed and web app credentials
  let creds;
  if (credentials.installed) {
    creds = credentials.installed;
  } else if (credentials.web) {
    creds = credentials.web;
  } else {
    throw new Error('Invalid credentials format. Must have either "installed" or "web" property.');
  }

  const { client_secret, client_id, redirect_uris } = creds;
  
  if (!client_id || !client_secret) {
    throw new Error('Client ID and Client Secret are required.');
  }

  // Use the first redirect URI, or default to localhost for Electron
  // Normalize the redirect URI - remove trailing slashes and ensure no port
  let redirectUri = redirect_uris && redirect_uris.length > 0 
    ? redirect_uris[0] 
    : 'http://localhost';
  
  // Normalize redirect URI
  redirectUri = redirectUri.trim().replace(/\/$/, ''); // Remove trailing slash
  if (redirectUri.includes('localhost') && redirectUri !== 'http://localhost') {
    // If it has a port or path, use just http://localhost
    redirectUri = 'http://localhost';
  }
  
  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Check if we have previously stored a token
  try {
    const token = await fsPromises.readFile(TOKEN_PATH, 'utf-8');
    oauth2Client.setCredentials(JSON.parse(token));
    return oauth2Client;
  } catch (err) {
    return getNewToken(oauth2Client, event, ipcMain);
  }
}

/**
 * Get and store new token after prompting for user authorization
 */
function getNewToken(oAuth2Client, event, ipcMain) {
  return new Promise((resolve, reject) => {
    let authUrl;
    try {
      authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to get refresh token
      });
    } catch (error) {
      if (event && event.sender) {
        event.sender.send('youtube-error', `Error generating auth URL: ${error.message}. Please check your credentials and redirect URI.`);
      }
      reject(new Error(`Error generating auth URL: ${error.message}`));
      return;
    }

    // Send auth URL to renderer
    if (event && event.sender) {
      event.sender.send('youtube-auth-url', authUrl);
    }

    // Wait for the code from the renderer
    const codeListener = (authEvent, code) => {
      ipcMain.removeListener('youtube-auth-code', codeListener);
      
      oAuth2Client.getToken(code, async (err, token) => {
        if (err) {
          if (event && event.sender) {
            event.sender.send('youtube-error', `Error retrieving access token: ${err.message}. Please verify your credentials and redirect URI match Google Cloud Console.`);
          }
          reject(new Error(`Error while trying to retrieve access token: ${err.message}`));
          return;
        }
        oAuth2Client.setCredentials(token);
        
        // Store the token to disk for later program executions
        try {
          await fsPromises.writeFile(TOKEN_PATH, JSON.stringify(token));
          if (event && event.sender) {
            event.sender.send('youtube-auth-success');
          }
          resolve(oAuth2Client);
        } catch (error) {
          if (event && event.sender) {
            event.sender.send('youtube-error', `Error storing token: ${error.message}`);
          }
          reject(new Error(`Error storing token: ${error.message}`));
        }
      });
    };

    // Set up listener for auth code
    ipcMain.once('youtube-auth-code', codeListener);
  });
}

/**
 * Save credentials to file
 */
async function saveCredentials(credentials) {
  try {
    await fsPromises.writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
    return true;
  } catch (error) {
    throw new Error(`Failed to save credentials: ${error.message}`);
  }
}

/**
 * Load credentials from file
 */
async function loadCredentials() {
  try {
    const content = await fsPromises.readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated() {
  try {
    const token = await fsPromises.readFile(TOKEN_PATH, 'utf-8');
    const credentials = await loadCredentials();
    if (!credentials) return false;
    
    let creds;
    if (credentials.installed) {
      creds = credentials.installed;
    } else if (credentials.web) {
      creds = credentials.web;
    } else {
      return false;
    }
    
    const { client_secret, client_id, redirect_uris } = creds;
    const redirectUri = redirect_uris && redirect_uris.length > 0 
      ? redirect_uris[0] 
      : 'http://localhost';
    
    oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
    oauth2Client.setCredentials(JSON.parse(token));
    
    // Test the token by getting user info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    await youtube.channels.list({ part: 'snippet', mine: true });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Upload video to YouTube
 */
async function uploadVideo(videoPath, metadata, progressCallback, ipcMain) {
  if (!oauth2Client) {
    const credentials = await loadCredentials();
    if (!credentials) {
      throw new Error('No credentials found. Please set up OAuth credentials first.');
    }
    await authorize(credentials, null, ipcMain);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const requestParameters = {
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: metadata.title || 'Untitled Video',
        description: metadata.description || '',
        tags: metadata.tags || [],
        categoryId: metadata.categoryId || '22', // People & Blogs
      },
      status: {
        privacyStatus: metadata.privacyStatus || 'private', // private, unlisted, public
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  };

  return new Promise((resolve, reject) => {
    youtube.videos.insert(
      requestParameters,
      {
        onUploadProgress: (evt) => {
          if (progressCallback && evt.bytesRead && evt.totalBytes) {
            const progress = Math.round((evt.bytesRead / evt.totalBytes) * 100);
            progressCallback({ progress, message: `Uploading: ${progress}%` });
          }
        },
      },
      (err, response) => {
        if (err) {
          reject(new Error(`YouTube API Error: ${err.message}`));
        } else {
          resolve({
            videoId: response.data.id,
            url: `https://www.youtube.com/watch?v=${response.data.id}`,
            title: response.data.snippet.title,
          });
        }
      }
    );
  });
}

/**
 * Revoke token and logout
 */
async function revokeToken() {
  try {
    if (oauth2Client) {
      await oauth2Client.revokeCredentials();
    }
    await fsPromises.unlink(TOKEN_PATH).catch(() => {});
    oauth2Client = null;
    return true;
  } catch (error) {
    throw new Error(`Failed to revoke token: ${error.message}`);
  }
}

module.exports = {
  authorize,
  saveCredentials,
  loadCredentials,
  isAuthenticated,
  uploadVideo,
  revokeToken,
  getNewToken,
};

