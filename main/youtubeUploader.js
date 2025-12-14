const { google } = require('googleapis');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// OAuth 2.0 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

let storageDir = null;
let profilesPath = null;
let tokensDir = null;

// Cache clients per profile to avoid re-creating for every call
const oauthClientsByProfileId = new Map();

function requireInit() {
  if (!storageDir || !profilesPath || !tokensDir) {
    throw new Error('YouTube uploader is not initialized. Call youtubeUploader.init({ storageDir }) first.');
  }
}

async function ensureStorage() {
  requireInit();
  await fsPromises.mkdir(storageDir, { recursive: true });
  await fsPromises.mkdir(tokensDir, { recursive: true });
  try {
    await fsPromises.access(profilesPath);
  } catch (_) {
    await fsPromises.writeFile(profilesPath, JSON.stringify({ profiles: [] }, null, 2));
  }
}

function tokenPathForProfile(profileId) {
  requireInit();
  return path.join(tokensDir, `${profileId}.json`);
}

async function readProfilesFile() {
  await ensureStorage();
  const raw = await fsPromises.readFile(profilesPath, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  return { profiles };
}

async function writeProfilesFile(profiles) {
  await ensureStorage();
  await fsPromises.writeFile(profilesPath, JSON.stringify({ profiles }, null, 2));
}

/**
 * Initialize storage directory (should be Electron app.getPath('userData') based).
 */
function init({ storageDir: dir }) {
  storageDir = dir;
  profilesPath = path.join(storageDir, 'profiles.json');
  tokensDir = path.join(storageDir, 'tokens');
}

function normalizeRedirectUri(uri) {
  let redirectUri = (uri || 'http://localhost').trim().replace(/\/$/, '');
  if (redirectUri.includes('localhost') && redirectUri !== 'http://localhost') {
    redirectUri = 'http://localhost';
  }
  return redirectUri;
}

function buildOAuthClient(credentials) {
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

  const redirectUri = normalizeRedirectUri(
    redirect_uris && redirect_uris.length > 0 ? redirect_uris[0] : 'http://localhost'
  );

  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

async function getProfile(profileId) {
  const { profiles } = await readProfilesFile();
  return profiles.find((p) => p.id === profileId) || null;
}

async function listProfiles() {
  const { profiles } = await readProfilesFile();
  // Do not leak secrets back to renderer
  return profiles.map((p) => ({
    id: p.id,
    label: p.label || '',
    channel: p.channel || null,
    updatedAt: p.updatedAt || null,
    createdAt: p.createdAt || null,
  }));
}

async function saveProfile({ id, label, credentials }) {
  if (!credentials) throw new Error('Credentials are required.');
  const { profiles } = await readProfilesFile();

  const now = new Date().toISOString();
  const profileId = id || crypto.randomUUID();
  const existingIdx = profiles.findIndex((p) => p.id === profileId);

  const profile = {
    id: profileId,
    label: (label || '').trim(),
    credentials,
    // keep any existing channel info
    channel: existingIdx >= 0 ? (profiles[existingIdx].channel || null) : null,
    createdAt: existingIdx >= 0 ? (profiles[existingIdx].createdAt || now) : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    profiles[existingIdx] = profile;
  } else {
    profiles.push(profile);
  }

  await writeProfilesFile(profiles);
  oauthClientsByProfileId.delete(profileId);
  return { id: profileId };
}

async function deleteProfile(profileId) {
  const { profiles } = await readProfilesFile();
  const next = profiles.filter((p) => p.id !== profileId);
  await writeProfilesFile(next);
  await fsPromises.unlink(tokenPathForProfile(profileId)).catch(() => {});
  oauthClientsByProfileId.delete(profileId);
  return true;
}

/**
 * Load or request authorization credentials
 */
async function authorizeProfile(profileId, event, ipcMain) {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('YouTube profile not found. Please create/select a profile first.');

  const client = buildOAuthClient(profile.credentials);
  oauthClientsByProfileId.set(profileId, client);

  // Check if we have previously stored a token (per profile)
  try {
    const token = await fsPromises.readFile(tokenPathForProfile(profileId), 'utf-8');
    client.setCredentials(JSON.parse(token));

    if (event && event.sender) {
      event.sender.send('youtube-auth-success', { profileId });
    }
    return client;
  } catch (err) {
    return getNewToken(profileId, client, event, ipcMain);
  }
}

/**
 * Get and store new token after prompting for user authorization
 */
function getNewToken(profileId, oAuth2Client, event, ipcMain) {
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
      event.sender.send('youtube-auth-url', { profileId, url: authUrl });
    }

    // Wait for the code from the renderer
    const codeListener = (authEvent, code) => {
      ipcMain.removeListener(`youtube-auth-code-internal:${profileId}`, codeListener);
      
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
          await fsPromises.writeFile(tokenPathForProfile(profileId), JSON.stringify(token));
          if (event && event.sender) {
            event.sender.send('youtube-auth-success', { profileId });
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
    ipcMain.once(`youtube-auth-code-internal:${profileId}`, codeListener);
  });
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated(profileId) {
  try {
    const profile = await getProfile(profileId);
    if (!profile) return false;

    const token = await fsPromises.readFile(tokenPathForProfile(profileId), 'utf-8');
    const client = buildOAuthClient(profile.credentials);
    client.setCredentials(JSON.parse(token));
    oauthClientsByProfileId.set(profileId, client);

    // Validate the token without requiring extra YouTube scopes.
    // (youtube.upload scope may not be sufficient for channels.list(mine:true))
    const accessTokenResponse = await client.getAccessToken();
    const accessToken = accessTokenResponse && accessTokenResponse.token ? accessTokenResponse.token : null;
    if (!accessToken) return false;
    return true;
  } catch (error) {
    return false;
  }
}

async function fetchAndStoreChannelInfo(profileId) {
  try {
    const profile = await getProfile(profileId);
    if (!profile) return null;
    const token = await fsPromises.readFile(tokenPathForProfile(profileId), 'utf-8');
    const client = buildOAuthClient(profile.credentials);
    client.setCredentials(JSON.parse(token));
    const youtube = google.youtube({ version: 'v3', auth: client });
    const resp = await youtube.channels.list({ part: 'snippet', mine: true });
    const first = resp.data && resp.data.items && resp.data.items[0];
    if (!first) return null;

    const { profiles } = await readProfilesFile();
    const idx = profiles.findIndex((p) => p.id === profileId);
    if (idx >= 0) {
      profiles[idx] = {
        ...profiles[idx],
        channel: {
          id: first.id,
          title: first.snippet && first.snippet.title ? first.snippet.title : '',
        },
        updatedAt: new Date().toISOString(),
      };
      await writeProfilesFile(profiles);
    }
    return { id: first.id, title: first.snippet && first.snippet.title ? first.snippet.title : '' };
  } catch (_) {
    return null;
  }
}

/**
 * Upload video to YouTube
 */
async function uploadVideo(profileId, videoPath, metadata, progressCallback, ipcMain) {
  let client = oauthClientsByProfileId.get(profileId) || null;
  if (!client) {
    const profile = await getProfile(profileId);
    if (!profile) {
      throw new Error('No YouTube profile selected. Please select a profile first.');
    }
    client = buildOAuthClient(profile.credentials);
    try {
      const token = await fsPromises.readFile(tokenPathForProfile(profileId), 'utf-8');
      client.setCredentials(JSON.parse(token));
      oauthClientsByProfileId.set(profileId, client);
    } catch (_) {
      throw new Error('Not authenticated for the selected YouTube profile. Please authenticate first.');
    }
  }

  const youtube = google.youtube({ version: 'v3', auth: client });

  const wantsSchedule = Boolean(metadata && metadata.publishAt);
  const effectivePrivacyStatus = wantsSchedule ? 'private' : (metadata.privacyStatus || 'private');

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
        privacyStatus: effectivePrivacyStatus, // private, unlisted, public
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  };

  // Scheduled publish time (RFC3339). YouTube requires privacyStatus=private when setting publishAt.
  if (wantsSchedule) {
    requestParameters.requestBody.status.publishAt = metadata.publishAt;
  }

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
            scheduledPublishAt: wantsSchedule ? metadata.publishAt : null,
          });
        }
      }
    );
  });
}

async function logoutProfile(profileId) {
  try {
    const client = oauthClientsByProfileId.get(profileId) || null;
    if (client) {
      await client.revokeCredentials().catch(() => {});
    }
    await fsPromises.unlink(tokenPathForProfile(profileId)).catch(() => {});
    oauthClientsByProfileId.delete(profileId);
    return true;
  } catch (error) {
    throw new Error(`Failed to logout: ${error.message}`);
  }
}

/**
 * Reset all local YouTube auth state (delete profiles and tokens).
 */
async function resetAuth() {
  try {
    await ensureStorage();
    const { profiles } = await readProfilesFile();
    for (const p of profiles) {
      await fsPromises.unlink(tokenPathForProfile(p.id)).catch(() => {});
    }
    await writeProfilesFile([]);
    oauthClientsByProfileId.clear();
    return true;
  } catch (error) {
    throw new Error(`Failed to reset auth: ${error.message}`);
  }
}

module.exports = {
  init,
  listProfiles,
  saveProfile,
  deleteProfile,
  authorizeProfile,
  isAuthenticated,
  uploadVideo,
  fetchAndStoreChannelInfo,
  logoutProfile,
  resetAuth,
  getNewToken,
};

