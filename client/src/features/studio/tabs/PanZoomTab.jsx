import React from 'react';
import { useStudio } from '../StudioContext';

export default function PanZoomTab() {
  const { state, actions, constants } = useStudio();

  const {
    panZoomImageFolder,
    panZoomOutputFolder,
    panZoomSocialPreset,
    panZoomVideoWidth,
    panZoomVideoHeight,
    panZoomFps,
    panZoomImageDuration,
    panZoomBatchSize,
    panZoomMaxVideos,
    panZoomShakeMagnitude,
    panZoomZoomMagnitude,
    panZoomPanMagnitude,
    panZoomBackgroundMusic,
    isPanZoomGenerating,
    panZoomProgress,
    panZoomProgressMessage,
    panZoomStatus,
  } = state;

  const {
    setPanZoomVideoWidth,
    setPanZoomVideoHeight,
    setPanZoomFps,
    setPanZoomImageDuration,
    setPanZoomBatchSize,
    setPanZoomMaxVideos,
    setPanZoomShakeMagnitude,
    setPanZoomZoomMagnitude,
    setPanZoomPanMagnitude,
    setPanZoomBackgroundMusic,
    handleSelectPanZoomImageFolder,
    handleSelectPanZoomOutputFolder,
    handlePanZoomSocialPreset,
    handleSelectPanZoomAudio,
    handleRemovePanZoomAudio,
    handleGeneratePanZoomVideo,
    handleCancelPanZoomVideo,
  } = actions;

  const { socialPresets } = constants;

  return (
    <div className="form-section">
      <div className="section-content">
        {/* Folder Selection - In One Row */}
        <div className="form-row">
          <div className="form-group">
            <label>Image Folder</label>
            <div className="input-with-button">
              <input
                type="text"
                value={panZoomImageFolder || 'No folder selected'}
                placeholder="Select folder containing images"
                readOnly
                style={{ flex: 1 }}
              />
              <button onClick={handleSelectPanZoomImageFolder} disabled={isPanZoomGenerating} className="small-btn">
                📁 Select Folder
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Output Folder</label>
            <div className="input-with-button">
              <input
                type="text"
                value={panZoomOutputFolder || 'No folder selected'}
                placeholder="Select output folder for videos"
                readOnly
                style={{ flex: 1 }}
              />
              <button onClick={handleSelectPanZoomOutputFolder} disabled={isPanZoomGenerating} className="small-btn">
                📁 Select Folder
              </button>
            </div>
          </div>
        </div>

        {/* Social Media Preset */}
        <div className="form-group">
          <label>Social Media Preset</label>
          <select
            value={panZoomSocialPreset}
            onChange={(e) => handlePanZoomSocialPreset(e.target.value)}
            disabled={isPanZoomGenerating}
          >
            {socialPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Video Settings */}
        <div className="form-row-four">
          <div className="form-group">
            <label>Video Width (px)</label>
            <input
              type="number"
              value={panZoomVideoWidth}
              onChange={(e) => setPanZoomVideoWidth(e.target.value)}
              min="1"
              disabled={isPanZoomGenerating}
            />
          </div>
          <div className="form-group">
            <label>Video Height (px)</label>
            <input
              type="number"
              value={panZoomVideoHeight}
              onChange={(e) => setPanZoomVideoHeight(e.target.value)}
              min="1"
              disabled={isPanZoomGenerating}
            />
          </div>
          <div className="form-group">
            <label>FPS</label>
            <input
              type="number"
              value={panZoomFps}
              onChange={(e) => setPanZoomFps(e.target.value)}
              min="1"
              max="60"
              disabled={isPanZoomGenerating}
            />
          </div>
          <div className="form-group">
            <label>Image Duration (seconds)</label>
            <input
              type="number"
              value={panZoomImageDuration}
              onChange={(e) => setPanZoomImageDuration(e.target.value)}
              min="0.1"
              step="0.1"
              disabled={isPanZoomGenerating}
            />
          </div>
        </div>

        {/* Batch Settings - In One Row */}
        <div className="form-row">
          <div className="form-group">
            <label>Batch Size</label>
            <input
              type="number"
              value={panZoomBatchSize}
              onChange={(e) => setPanZoomBatchSize(e.target.value)}
              min="1"
              disabled={isPanZoomGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>Number of images per video</small>
          </div>
          <div className="form-group">
            <label>Max Videos to Create</label>
            <input
              type="number"
              value={panZoomMaxVideos}
              onChange={(e) => setPanZoomMaxVideos(e.target.value)}
              min="0"
              disabled={isPanZoomGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>0 = create all possible videos</small>
          </div>
        </div>

        {/* Effect Settings - All in One Row */}
        <div className="form-row-four">
          <div className="form-group">
            <label>Shake Magnitude</label>
            <input
              type="number"
              value={panZoomShakeMagnitude}
              onChange={(e) => setPanZoomShakeMagnitude(e.target.value)}
              min="0"
              step="0.5"
              disabled={isPanZoomGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>Subtle shake effect (pixels)</small>
          </div>
          <div className="form-group">
            <label>Zoom Magnitude</label>
            <input
              type="number"
              value={panZoomZoomMagnitude}
              onChange={(e) => setPanZoomZoomMagnitude(e.target.value)}
              min="0"
              max="0.5"
              step="0.01"
              disabled={isPanZoomGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>Slight zoom in (0-0.5)</small>
          </div>
          <div className="form-group">
            <label>Pan Magnitude</label>
            <input
              type="number"
              value={panZoomPanMagnitude}
              onChange={(e) => setPanZoomPanMagnitude(e.target.value)}
              min="0"
              step="5"
              disabled={isPanZoomGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>Maximum pan distance (pixels)</small>
          </div>
        </div>

        {/* Audio Settings */}
        <div className="form-group">
          <label>Background Music</label>
          <div className="input-with-button">
            <input
              type="text"
              value={panZoomBackgroundMusic.path ? panZoomBackgroundMusic.path.split(/[/\\]/).pop() : ''}
              placeholder="No audio file selected"
              readOnly
              style={{ flex: 1 }}
            />
            <button onClick={handleSelectPanZoomAudio} disabled={isPanZoomGenerating} className="small-btn">
              🎵 Select Audio File
            </button>
            {panZoomBackgroundMusic.path && (
              <button onClick={handleRemovePanZoomAudio} disabled={isPanZoomGenerating} className="small-btn" style={{ backgroundColor: '#f44336', color: 'white' }}>
                ❌ Remove
              </button>
            )}
          </div>
        </div>

        {panZoomBackgroundMusic.enabled && panZoomBackgroundMusic.path && (
          <div className="form-row">
            <div className="form-group">
              <label>Volume (0-1)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={panZoomBackgroundMusic.volume}
                onChange={(e) =>
                  setPanZoomBackgroundMusic((prev) => ({
                    ...prev,
                    volume: parseFloat(e.target.value),
                  }))
                }
                disabled={isPanZoomGenerating}
                style={{ ['--range-progress']: `${(panZoomBackgroundMusic.volume / 1) * 100}%` }}
              />
              <span>{Math.round(panZoomBackgroundMusic.volume * 100)}%</span>
            </div>
            <div className="form-group">
              <label>Fade In (seconds)</label>
              <input
                type="number"
                value={panZoomBackgroundMusic.fadeIn}
                onChange={(e) =>
                  setPanZoomBackgroundMusic((prev) => ({
                    ...prev,
                    fadeIn: parseFloat(e.target.value),
                  }))
                }
                min="0"
                step="0.5"
                disabled={isPanZoomGenerating}
              />
            </div>
            <div className="form-group">
              <label>Fade Out (seconds)</label>
              <input
                type="number"
                value={panZoomBackgroundMusic.fadeOut}
                onChange={(e) =>
                  setPanZoomBackgroundMusic((prev) => ({
                    ...prev,
                    fadeOut: parseFloat(e.target.value),
                  }))
                }
                min="0"
                step="0.5"
                disabled={isPanZoomGenerating}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          className="generate-button"
          onClick={handleGeneratePanZoomVideo}
          disabled={isPanZoomGenerating || !panZoomImageFolder || !panZoomOutputFolder}
        >
          {isPanZoomGenerating ? '⏳ Generating...' : '🎥 Generate Pan/Zoom Videos'}
        </button>

        {/* Progress Bar */}
        {isPanZoomGenerating && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${Math.round(panZoomProgress)}%` }}>
                <span className="progress-text">{Math.round(panZoomProgress)}%</span>
              </div>
            </div>
            {panZoomProgressMessage && <p className="progress-message">{panZoomProgressMessage}</p>}
            <div className="cancel-button-container">
              <button onClick={handleCancelPanZoomVideo} className="cancel-button">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {panZoomStatus && <p className="status-message">{panZoomStatus}</p>}
      </div>
    </div>
  );
}


