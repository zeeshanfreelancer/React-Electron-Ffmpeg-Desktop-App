import React from 'react';
import { useStudio } from '../StudioContext';

export default function EffectsTab() {
  const { state, actions, constants } = useStudio();

  const {
    effectImageFolder,
    effectOutputFolder,
    effectSocialPreset,
    effectVideoWidth,
    effectVideoHeight,
    effectFps,
    effectImageDuration,
    effectBatchSize,
    effectBackgroundMusic,
    effectPreset,
    effectTransitionType,
    effectTransitionDuration,
    isEffectGenerating,
    effectProgress,
    effectProgressMessage,
    effectStatus,
  } = state;

  const {
    setEffectVideoWidth,
    setEffectVideoHeight,
    setEffectFps,
    setEffectImageDuration,
    setEffectBatchSize,
    setEffectBackgroundMusic,
    setEffectPreset,
    setEffectTransitionType,
    setEffectTransitionDuration,
    handleSelectEffectImageFolder,
    handleSelectEffectOutputFolder,
    handleEffectSocialPreset,
    handleSelectEffectAudio,
    handleGenerateEffectVideo,
    handleCancelEffectVideo,
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
                value={effectImageFolder || 'No folder selected'}
                placeholder="Select folder containing images"
                readOnly
                style={{ flex: 1 }}
              />
              <button onClick={handleSelectEffectImageFolder} disabled={isEffectGenerating} className="small-btn">
                📁 Select Folder
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Output Folder</label>
            <div className="input-with-button">
              <input
                type="text"
                value={effectOutputFolder || 'No folder selected'}
                placeholder="Select output folder for videos"
                readOnly
                style={{ flex: 1 }}
              />
              <button onClick={handleSelectEffectOutputFolder} disabled={isEffectGenerating} className="small-btn">
                📁 Select Folder
              </button>
            </div>
          </div>
        </div>

        {/* Social Media Preset */}
        <div className="form-group">
          <label>Social Media Preset</label>
          <select value={effectSocialPreset} onChange={(e) => handleEffectSocialPreset(e.target.value)} disabled={isEffectGenerating}>
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
              value={effectVideoWidth}
              onChange={(e) => setEffectVideoWidth(e.target.value)}
              min="1"
              disabled={isEffectGenerating}
            />
          </div>
          <div className="form-group">
            <label>Video Height (px)</label>
            <input
              type="number"
              value={effectVideoHeight}
              onChange={(e) => setEffectVideoHeight(e.target.value)}
              min="1"
              disabled={isEffectGenerating}
            />
          </div>
          <div className="form-group">
            <label>FPS</label>
            <input
              type="number"
              value={effectFps}
              onChange={(e) => setEffectFps(e.target.value)}
              min="1"
              max="60"
              disabled={isEffectGenerating}
            />
          </div>
          <div className="form-group">
            <label>Image Duration (seconds)</label>
            <input
              type="number"
              value={effectImageDuration}
              onChange={(e) => setEffectImageDuration(e.target.value)}
              min="0.1"
              step="0.1"
              disabled={isEffectGenerating}
            />
          </div>
        </div>

        {/* Batch Settings */}
        <div className="form-row">
          <div className="form-group">
            <label>Batch Size</label>
            <input
              type="number"
              value={effectBatchSize}
              onChange={(e) => setEffectBatchSize(e.target.value)}
              min="1"
              disabled={isEffectGenerating}
            />
            <small style={{ color: '#666', fontSize: '11px' }}>Number of images per video</small>
          </div>
        </div>

        {/* Transition + Effect */}
        <div className="form-row-four">
          <div className="form-group">
            <label>Effect Preset</label>
            <select value={effectPreset} onChange={(e) => setEffectPreset(e.target.value)} disabled={isEffectGenerating}>
              <option value="none">None</option>
              <option value="smooth">Smooth (Recommended)</option>
              <option value="cinematic">Cinematic</option>
              <option value="shake">Shake</option>
              <option value="zoom">Zoom</option>
              <option value="pan">Pan</option>
              <option value="custom">Custom (use Video Generator tab)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Transition</label>
            <select value={effectTransitionType} onChange={(e) => setEffectTransitionType(e.target.value)} disabled={isEffectGenerating}>
              <option value="none">None</option>
              <option value="crossfade">Crossfade</option>
              <option value="slide-left">Slide Left</option>
              <option value="slide-right">Slide Right</option>
              <option value="wipe-left">Wipe Left</option>
              <option value="wipe-right">Wipe Right</option>
              <option value="wipe-up">Wipe Up</option>
              <option value="wipe-down">Wipe Down</option>
            </select>
          </div>
          <div className="form-group">
            <label>Transition Duration (seconds)</label>
            <input
              type="number"
              value={effectTransitionDuration}
              onChange={(e) => setEffectTransitionDuration(e.target.value)}
              min="0"
              step="0.1"
              disabled={isEffectGenerating || effectTransitionType === 'none'}
            />
          </div>
        </div>

        {/* Audio Settings */}
        <div className="form-group">
          <label>Background Music</label>
          <button onClick={handleSelectEffectAudio} disabled={isEffectGenerating} className="audio-control-btn">
            🎵 Select Audio File
          </button>
          {effectBackgroundMusic.path && (
            <p className="file-info">Selected: {effectBackgroundMusic.path.split(/[/\\]/).pop()}</p>
          )}
        </div>

        {effectBackgroundMusic.enabled && effectBackgroundMusic.path && (
          <div className="form-row">
            <div className="form-group">
              <label>Volume (0-1)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={effectBackgroundMusic.volume}
                onChange={(e) =>
                  setEffectBackgroundMusic((prev) => ({
                    ...prev,
                    volume: parseFloat(e.target.value),
                  }))
                }
                disabled={isEffectGenerating}
              />
              <span>{Math.round(effectBackgroundMusic.volume * 100)}%</span>
            </div>
            <div className="form-group">
              <label>Fade In (seconds)</label>
              <input
                type="number"
                value={effectBackgroundMusic.fadeIn}
                onChange={(e) =>
                  setEffectBackgroundMusic((prev) => ({
                    ...prev,
                    fadeIn: parseFloat(e.target.value),
                  }))
                }
                min="0"
                step="0.5"
                disabled={isEffectGenerating}
              />
            </div>
            <div className="form-group">
              <label>Fade Out (seconds)</label>
              <input
                type="number"
                value={effectBackgroundMusic.fadeOut}
                onChange={(e) =>
                  setEffectBackgroundMusic((prev) => ({
                    ...prev,
                    fadeOut: parseFloat(e.target.value),
                  }))
                }
                min="0"
                step="0.5"
                disabled={isEffectGenerating}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          className="generate-button"
          onClick={handleGenerateEffectVideo}
          disabled={isEffectGenerating || !effectImageFolder || !effectOutputFolder}
        >
          {isEffectGenerating ? '⏳ Generating...' : '✨ Generate Effect Videos'}
        </button>

        {/* Progress Bar */}
        {isEffectGenerating && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${effectProgress}%` }}>
                <span className="progress-text">{effectProgress}%</span>
              </div>
            </div>
            {effectProgressMessage && <p className="progress-message">{effectProgressMessage}</p>}
            <div className="cancel-button-container">
              <button onClick={handleCancelEffectVideo} className="cancel-button">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {effectStatus && <p className="status-message">{effectStatus}</p>}
      </div>
    </div>
  );
}


