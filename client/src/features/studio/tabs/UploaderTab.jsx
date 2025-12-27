import React from 'react';
import { useStudio } from '../StudioContext';

export default function UploaderTab() {
  const { state, actions } = useStudio();

  const {
    youtubeProfiles,
    selectedYoutubeProfileId,
    youtubeAuthenticated,
    youtubeProfileLabel,
    youtubeCredentials,
    showCredentialsForm,
    youtubeAuthCode,
    showAuthCodeInput,
    youtubeBatchItems,
    editingBatchItemId,
    editingBatchForm,
    youtubeStatus,
  } = state;

  const {
    setSelectedYoutubeProfileId,
    setYoutubeProfileLabel,
    setYoutubeCredentials,
    setShowCredentialsForm,
    setShowAuthCodeInput,
    setYoutubeAuthCode,
    setYoutubeAuthenticated,
    setYoutubeBatchItems,
    setEditingBatchItemId,
    setEditingBatchForm,
    handleYoutubeSelectProfile,
    handleYoutubeDeleteProfile,
    handleYoutubeResetAuth,
    handleYoutubeLogout,
    handleYoutubeAuthenticate,
    handleYoutubeAuthCodeSubmit,
    handleSaveYoutubeCredentials,
    handleSelectYoutubeVideosBatch,
    handleBatchUploadAllParallel,
    handleBatchClear,
    handleApplyFirstVideoSettingsToAll,
    openBatchItemEditor,
    closeBatchItemEditor,
    saveBatchItemEditor,
    startBatchUploadItem,
  } = actions;

  const selectedYoutubeProfile = youtubeProfiles.find((p) => p.id === selectedYoutubeProfileId) || null;
  const editingBatchItem = editingBatchItemId ? youtubeBatchItems.find((x) => x.id === editingBatchItemId) : null;
  const isEditingBatchUploading = Boolean(editingBatchItem && editingBatchItem.status === 'uploading');
  const editingBatchFilename = editingBatchItem ? editingBatchItem.path.split(/[/\\]/).pop() : '';
  const isAnyBatchYoutubeUploading = youtubeBatchItems.some((x) => x.status === 'uploading');

  return (
    <div className="form-section">
      <div className="section-content">
        {/* Authentication Section */}
        <div
          className="form-group uploader-block"
          style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>🔐 Authentication</h3>
            <div
              className="uploader-status-text"
              style={{
                fontSize: '13px',
                color: selectedYoutubeProfileId && youtubeAuthenticated ? 'green' : '#666',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedYoutubeProfileId
                ? youtubeAuthenticated
                  ? `✅ Authenticated${
                      selectedYoutubeProfile?.channel?.title ? ` as ${selectedYoutubeProfile.channel.title}` : ''
                    }`
                  : 'Not authenticated'
                : 'No profile selected'}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap', overflowX: 'auto' }}>
              <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Channel Profile</label>
              <select
                value={selectedYoutubeProfileId}
                onChange={(e) => handleYoutubeSelectProfile(e.target.value)}
                disabled={isAnyBatchYoutubeUploading}
                style={{ padding: '8px', minWidth: '260px', flex: '1 0 260px' }}
              >
                <option value="">-- Select or create a profile --</option>
                {youtubeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.channel && p.channel.title ? p.channel.title : p.label || p.id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSelectedYoutubeProfileId('');
                  setYoutubeProfileLabel('');
                  setYoutubeCredentials({ clientId: '', clientSecret: '', redirectUri: '' });
                  setShowCredentialsForm(true);
                  setShowAuthCodeInput(false);
                  setYoutubeAuthCode('');
                  setYoutubeAuthenticated(false);
                }}
                className="small-btn"
                disabled={isAnyBatchYoutubeUploading}
              >
                ➕ New
              </button>
              <button
                onClick={handleYoutubeDeleteProfile}
                className="small-btn"
                disabled={isAnyBatchYoutubeUploading || !selectedYoutubeProfileId}
                style={{ backgroundColor: '#dc3545' }}
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => setShowCredentialsForm(!showCredentialsForm)}
                className="small-btn"
                disabled={isAnyBatchYoutubeUploading}
              >
                {showCredentialsForm
                  ? '❌ Cancel'
                  : selectedYoutubeProfileId
                    ? '⚙️ Edit Profile Credentials'
                    : '⚙️ Setup Profile'}
              </button>
              <button
                onClick={handleYoutubeResetAuth}
                className="small-btn"
                style={{ backgroundColor: '#6c757d' }}
                disabled={isAnyBatchYoutubeUploading}
              >
                🧹 Reset All Profiles
              </button>
              {youtubeAuthenticated && (
                <button
                  onClick={handleYoutubeLogout}
                  className="small-btn"
                  style={{ backgroundColor: '#dc3545' }}
                  disabled={isAnyBatchYoutubeUploading}
                >
                  🚪 Logout
                </button>
              )}
              {!youtubeAuthenticated && !showCredentialsForm && !showAuthCodeInput && selectedYoutubeProfileId && (
                <button
                  onClick={handleYoutubeAuthenticate}
                  className="small-btn"
                  style={{ backgroundColor: '#28a745' }}
                  disabled={isAnyBatchYoutubeUploading}
                >
                  🔑 Authenticate
                </button>
              )}
            </div>
            <small style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '8px' }}>
              Each profile stores its own token, so you can upload to multiple YouTube channels by switching profiles.
            </small>
          </div>

          {showAuthCodeInput && (
            <div className="uploader-form-block" style={{ padding: '15px', borderRadius: '5px', marginTop: '10px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#e7f3ff',
                  borderRadius: '5px',
                }}
              >
                <strong>📋 Instructions:</strong>
                <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
                  <li>After authorizing, you'll be redirected to a page that says "This site can't be reached" - this is normal!</li>
                  <li>Look at the URL in your browser's address bar</li>
                  <li>
                    Copy the <strong>entire URL</strong> (or just the code part after "code=")
                  </li>
                  <li>Paste it in the field below - the app will automatically extract the code</li>
                </ol>
                <p style={{ margin: '5px 0', fontStyle: 'italic' }}>
                  Example URL:{' '}
                  <code style={{ fontSize: '10px', backgroundColor: '#f0f0f0', padding: '2px 4px' }}>
                    http://localhost/?code=4/0ATX87lMXer-07T4IBVLMaM6HWntf9JzYlyhRQDUHy0NYUhyRTV04Ooy-B-mA34leI2Tg7g
                  </code>
                </p>
              </div>
              <div className="form-group">
                <label>Authorization Code or Full URL</label>
                <div className="input-with-button">
                  <input
                    type="text"
                    value={youtubeAuthCode}
                    onChange={(e) => setYoutubeAuthCode(e.target.value)}
                    placeholder="Paste the full URL or just the code here"
                    style={{ flex: 1, padding: '8px' }}
                  />
                  <button onClick={handleYoutubeAuthCodeSubmit} className="small-btn" style={{ backgroundColor: '#28a745' }}>
                    ✅ Submit
                  </button>
                </div>
                <small style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '5px' }}>
                  You can paste either the full URL or just the code - both will work!
                </small>
              </div>
              <button
                onClick={() => {
                  setShowAuthCodeInput(false);
                  setYoutubeAuthCode('');
                }}
                className="small-btn"
                style={{ marginTop: '10px' }}
              >
                ❌ Cancel
              </button>
            </div>
          )}

          {showCredentialsForm && (
            <div className="uploader-form-block" style={{ padding: '15px', borderRadius: '5px', marginTop: '10px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '5px',
                  border: '1px solid #ffc107',
                }}
              >
                <strong>📋 Setup Instructions:</strong>
                <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
                  <li>
                    Go to{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                      Google Cloud Console
                    </a>
                  </li>
                  <li>Create a new project or select an existing one</li>
                  <li>Enable YouTube Data API v3</li>
                  <li>
                    <strong>Configure OAuth Consent Screen:</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Go to "OAuth consent screen" in the left menu</li>
                      <li>Choose "External" (unless you have a Google Workspace)</li>
                      <li>Fill in App name, User support email, Developer contact</li>
                      <li>Add your email to "Test users" if app is in Testing mode</li>
                      <li>Save and continue through all steps</li>
                    </ul>
                  </li>
                  <li>Create OAuth 2.0 Client ID credentials</li>
                  <li>
                    <strong>Important:</strong> Choose "Desktop app" or "Installed application" as the application type
                  </li>
                  <li>
                    Add <code>http://localhost</code> (exactly, no trailing slash) as an authorized redirect URI
                  </li>
                  <li>Copy the Client ID and Client Secret below</li>
                </ol>
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px',
                    backgroundColor: '#f8d7da',
                    borderRadius: '3px',
                    border: '1px solid #f5c6cb',
                  }}
                >
                  <strong>⚠️ If you get "403: access_denied":</strong>
                  <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                    <li>Make sure OAuth consent screen is configured</li>
                    <li>If app is in "Testing" mode, add your Google account email to "Test users"</li>
                    <li>
                      Verify redirect URI matches exactly: <code>http://localhost</code>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="form-group">
                <label>Profile Name (optional)</label>
                <input
                  type="text"
                  value={youtubeProfileLabel}
                  onChange={(e) => setYoutubeProfileLabel(e.target.value)}
                  placeholder="e.g., My Channel 1"
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
              <div className="form-group">
                <label>Client ID *</label>
                <input
                  type="text"
                  value={youtubeCredentials.clientId}
                  onChange={(e) => setYoutubeCredentials((prev) => ({ ...prev, clientId: e.target.value }))}
                  placeholder="Enter Client ID (ends with .apps.googleusercontent.com)"
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
              <div className="form-group">
                <label>Client Secret *</label>
                <input
                  type="password"
                  value={youtubeCredentials.clientSecret}
                  onChange={(e) => setYoutubeCredentials((prev) => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder="Enter Client Secret"
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
              <div className="form-group">
                <label>Redirect URI</label>
                <input
                  type="text"
                  value={youtubeCredentials.redirectUri}
                  onChange={(e) => setYoutubeCredentials((prev) => ({ ...prev, redirectUri: e.target.value }))}
                  placeholder="http://localhost (must match Google Cloud Console)"
                  style={{ width: '100%', padding: '8px' }}
                />
                <small style={{ color: '#666', fontSize: '11px' }}>
                  Must exactly match the redirect URI configured in Google Cloud Console
                </small>
              </div>
              <button onClick={handleSaveYoutubeCredentials} className="small-btn" style={{ backgroundColor: '#007bff' }}>
                💾 Save Credentials
              </button>
            </div>
          )}
        </div>

        {/* Batch Upload */}
        <div
          className="form-group uploader-block"
          style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px' }}
        >
          <h3 style={{ marginTop: 0 }}>🧾 Batch Upload (multiple videos at the same time)</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <button
              onClick={handleSelectYoutubeVideosBatch}
              className="small-btn"
              disabled={isAnyBatchYoutubeUploading || !selectedYoutubeProfileId}
            >
              📁 Select Multiple Videos
            </button>
            <button
              onClick={handleApplyFirstVideoSettingsToAll}
              className="small-btn"
              style={{ backgroundColor: '#17a2b8' }}
              disabled={youtubeBatchItems.length < 2 || isAnyBatchYoutubeUploading}
            >
              📋 Apply First Video Settings to All
            </button>
            <button
              onClick={handleBatchUploadAllParallel}
              className="small-btn"
              style={{ backgroundColor: '#28a745' }}
              disabled={!selectedYoutubeProfileId || !youtubeAuthenticated || youtubeBatchItems.length === 0}
            >
              🚀 Upload All (Parallel)
            </button>
            <button
              onClick={handleBatchClear}
              className="small-btn"
              style={{ backgroundColor: '#6c757d' }}
              disabled={youtubeBatchItems.length === 0}
            >
              🧹 Clear Queue
            </button>
          </div>

          {youtubeBatchItems.length > 0 ? (
            <>
              <div className="uploader-form-block" style={{ borderRadius: '6px', padding: '10px', maxHeight: '220px', overflow: 'auto' }}>
                {youtubeBatchItems.map((item) => (
                  <div key={item.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>{item.path.split(/[/\\]/).pop()}</div>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setYoutubeBatchItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, title: v } : x)));
                          }}
                          disabled={item.status === 'uploading'}
                          style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                          placeholder="Title"
                        />
                        <div
                          style={{
                            fontSize: '11px',
                            marginTop: '4px',
                            color: item.status === 'error' ? '#d32f2f' : '#666',
                          }}
                        >
                          {item.status === 'uploading' ? `${item.progress || 0}% ${item.message || ''}` : ''}
                          {item.status === 'done' ? `✅ Done${item.result?.url ? `: ${item.result.url}` : ''}` : ''}
                          {item.status === 'error' ? `❌ ${item.error}` : ''}
                          {item.status === 'pending' ? '⏸️ Pending' : ''}
                        </div>
                      </div>

                      {/* Edit button must appear before Upload for each video */}
                      <button
                        onClick={() => openBatchItemEditor(item)}
                        className="small-btn"
                        disabled={item.status === 'uploading'}
                        style={{ backgroundColor: editingBatchItemId === item.id ? '#17a2b8' : '#6c757d' }}
                        title="Edit metadata for this video"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        onClick={() => startBatchUploadItem(item.id)}
                        className="small-btn"
                        disabled={!youtubeAuthenticated || item.status === 'uploading'}
                        style={{ backgroundColor: '#007bff' }}
                      >
                        📤 Upload
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dedicated editor UI appears below the entire list */}
              {editingBatchItemId && (
                <div className="uploader-form-block" style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>✏️ Edit batch video details</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{editingBatchFilename}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={saveBatchItemEditor}
                        className="small-btn"
                        style={{ backgroundColor: '#007bff' }}
                        disabled={!editingBatchItemId || isEditingBatchUploading}
                      >
                        💾 Save
                      </button>
                      <button onClick={closeBatchItemEditor} className="small-btn">
                        ✅ Done
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label>Title</label>
                    <input
                      type="text"
                      value={editingBatchForm.title}
                      onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, title: e.target.value }))}
                      disabled={isEditingBatchUploading}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editingBatchForm.description}
                      onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, description: e.target.value }))}
                      disabled={isEditingBatchUploading}
                      rows={4}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={editingBatchForm.tags}
                        onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, tags: e.target.value }))}
                        disabled={isEditingBatchUploading}
                        placeholder="tag1, tag2, tag3"
                        style={{ width: '100%', padding: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Privacy Status</label>
                      <select
                        value={editingBatchForm.privacyStatus}
                        onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, privacyStatus: e.target.value }))}
                        disabled={isEditingBatchUploading}
                        style={{ width: '100%', padding: '8px' }}
                      >
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>

                  {/* Scheduling (per video) */}
                  <div
                    className="form-group uploader-block"
                    style={{ marginTop: '10px', padding: '12px', borderRadius: '8px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: editingBatchForm.scheduleEnabled ? '10px' : 0 }}>
                      <input
                        id="batchScheduleEnabled"
                        type="checkbox"
                        checked={Boolean(editingBatchForm.scheduleEnabled)}
                        onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, scheduleEnabled: e.target.checked }))}
                        disabled={isEditingBatchUploading}
                      />
                      <label htmlFor="batchScheduleEnabled" style={{ margin: 0 }}>
                        Schedule publish (upload now, publish later)
                      </label>
                    </div>

                    {editingBatchForm.scheduleEnabled && (
                      <>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label>Publish Date &amp; Time (your local time)</label>
                          <input
                            type="datetime-local"
                            value={editingBatchForm.publishAtLocal}
                            onChange={(e) => setEditingBatchForm((prev) => ({ ...prev, publishAtLocal: e.target.value }))}
                            disabled={isEditingBatchUploading}
                            style={{ width: '100%', padding: '8px' }}
                          />
                        </div>
                        <small style={{ color: '#666', fontSize: '11px' }}>
                          Scheduling requires the video to be <strong>Private</strong>. If you selected Public/Unlisted, the app will still upload as Private and schedule publishing.
                        </small>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <small style={{ color: '#666', fontSize: '11px' }}>
              Tip: Select multiple files, then click “Upload All (Parallel)” to upload multiple videos at the same time.
            </small>
          )}
        </div>

        {/* Status Message */}
        {youtubeStatus && <p className="status-message">{youtubeStatus}</p>}
      </div>
    </div>
  );
}


