import React from 'react';
import { useStudio } from '../StudioContext';

export default function AdvancedTab() {
  const { state, actions, constants } = useStudio();

  const {
    activeSettingsTab,
    isGenerating,
    imagePath,
    imagePaths,
    videoPath,
    socialPreset,
    text,
    width,
    height,
    scrollSpeed,
    scrollDirection,
    fps,
    textColor,
    fontSize,
    fontFamily,
    textAnimation,
    textEffects,
    imageFilter,
    backgroundRotation,
    backgroundGradient,
    overlayOpacity,
    colorAdjustments,
    audioText,
    audioLanguage,
    audioProvider,
    ttsVoices,
    selectedTtsVoiceName,
    xttsVoices,
    xttsVoicesError,
    xttsVoicesLoading,
    selectedXttsVoiceId,
    backgroundMusic,
    exportFormat,
    qualityPreset,
    bitrate,
    outputDirectory,
    exportGif,
    exportImageSequence,
    exportThumbnail,
    progress,
    progressMessage,
    audioProgress,
    audioProgressMessage,
    videoProgress,
    videoProgressMessage,
    scrollingElapsedSec,
    scrollingEtaSec,
    scrollingStatus,
    batchVideos,
    batchVideoMode,
    batchVideoCount,
    editingBatchVideoIndex,
  } = state;

  const {
    setActiveSettingsTab,
    setText,
    setWidth,
    setHeight,
    setScrollSpeed,
    setScrollDirection,
    setFps,
    setTextColor,
    setFontSize,
    setFontFamily,
    setTextAnimation,
    setTextEffects,
    setImageFilter,
    setBackgroundRotation,
    setBackgroundGradient,
    setOverlayOpacity,
    setColorAdjustments,
    setAudioText,
    setAudioLanguage,
    setAudioProvider,
    setSelectedTtsVoiceName,
    setSelectedXttsVoiceId,
    setBackgroundMusic,
    setExportFormat,
    setQualityPreset,
    setBitrate,
    setOutputDirectory,
    setExportGif,
    setExportImageSequence,
    setExportThumbnail,
    handleSaveProject,
    handleLoadProject,
    handleSelectImage,
    handleSelectMultipleImages,
    handleSelectVideo,
    handleSocialPreset,
    handleSelectAudio,
    handleRemoveAudio,
    handleSelectOutputDirectory,
    handleGenerate,
    handleCancel,
    setBatchVideos,
    setBatchVideoMode,
    setBatchVideoCount,
    setEditingBatchVideoIndex,
    handleCreateBatchVideos,
    handleEditBatchVideo,
    handleSaveBatchVideo,
    handleBackToBatchVideos,
    handleApplySettingsToAll,
    handleRemoveSettingsFromAll,
    handleSaveBatchProject,
    handleLoadBatchProject,
  } = actions;

  const {
    socialPresets,
    scrollDirections,
    fontFamilies,
    animationTypes,
    narrationLanguages,
    imageFilters,
    qualityPresets,
    exportFormats,
  } = constants;

  const formatClock = (totalSeconds) => {
    if (totalSeconds == null) return '';
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="form-section">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeSettingsTab === 'batch' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('batch')}
          disabled={isGenerating}
        >
          📦 Batch Videos
        </button>
        <button
          className={`tab-button ${activeSettingsTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('basic')}
          disabled={isGenerating}
        >
          ⚙️ Basic Settings
        </button>
        <button
          className={`tab-button ${activeSettingsTab === 'textEffects' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('textEffects')}
          disabled={isGenerating}
        >
          ✨ Text Effects
        </button>
        <button
          className={`tab-button ${activeSettingsTab === 'background' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('background')}
          disabled={isGenerating}
        >
          🖼️ Background Settings
        </button>
        <button
          className={`tab-button ${activeSettingsTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('audio')}
          disabled={isGenerating}
        >
          🎵 Audio Settings
        </button>
        <button
          className={`tab-button ${activeSettingsTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveSettingsTab('quality')}
          disabled={isGenerating}
        >
          🎬 Export Video
        </button>
      </div>

      {/* Batch Videos Tab */}
      {activeSettingsTab === 'batch' && (
        <div className="section-content">
          {/* Video Creation Options */}
          <div className="form-group">
            <label>Video Creation Options</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <label className="radio-label" style={{ display: 'flex', alignItems: 'center', marginBottom: 0, gap: '8px', }}>
                <input
                  type="radio"
                  name="batchMode"
                  value="single"
                  checked={batchVideoMode === 'single'}
                  onChange={(e) => setBatchVideoMode(e.target.value)}
                  disabled={isGenerating}
                />
                Single Video
              </label>
              <label className="radio-label" style={{ display: 'flex', alignItems: 'center', marginBottom: 0, gap: '8px' }}>
                <input
                  type="radio"
                  name="batchMode"
                  value="multiple"
                  checked={batchVideoMode === 'multiple'}
                  onChange={(e) => setBatchVideoMode(e.target.value)}
                  disabled={isGenerating}
                />
                Multiple Videos
              </label>
              <button
                onClick={handleCreateBatchVideos}
                disabled={isGenerating}
                className="small-btn"
                style={{ marginLeft: '8px' }}
              >
                ➕ Create Videos
              </button>
            </div>
            {batchVideoMode === 'multiple' && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Number of Videos</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={batchVideoCount}
                  onChange={(e) => setBatchVideoCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isGenerating}
                  className="form-control"
                />
              </div>
            )}
          </div>

          {/* Project Management */}
          <div className="form-group batch-section-divider" style={{ marginTop: '24px', paddingTop: '16px' }}>
            <label>Project Management</label>
            <div className="button-group-full">
              <button onClick={handleSaveBatchProject} disabled={isGenerating} className="small-btn">
                💾 Save Project
              </button>
              <button onClick={handleLoadBatchProject} disabled={isGenerating} className="small-btn">
                📂 Load Project
              </button>
            </div>
          </div>

          {/* Batch Settings */}
          {batchVideos.length > 0 && (
            <div className="form-group batch-section-divider" style={{ marginTop: '24px', paddingTop: '16px' }}>
              <label>Batch Settings</label>
              <div className="button-group-full" style={{ marginBottom: '8px' }}>
                <button
                  onClick={handleApplySettingsToAll}
                  disabled={isGenerating}
                  className="small-btn"
                  style={{ flex: 1 }}
                >
                  ⚙️ Apply Current Settings to All Videos
                </button>
                <button
                  onClick={handleRemoveSettingsFromAll}
                  disabled={isGenerating}
                  className="small-btn"
                  style={{ flex: 1, backgroundColor: '#f44336', color: 'white' }}
                >
                  🗑️ Remove Settings from All Videos
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Apply current settings to all videos, or remove all settings to reset them to defaults.
              </p>
            </div>
          )}

          {/* Per-Video Controls */}
          {batchVideos.length > 0 && (
            <div className="form-group batch-section-divider" style={{ marginTop: '24px', paddingTop: '16px' }}>
              <label>Videos ({batchVideos.length})</label>
              <div className="batch-videos-list-container" style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '4px', padding: '8px' }}>
                {batchVideos.map((video, index) => (
                  <div
                    key={video.id || index}
                    className={`batch-video-item ${editingBatchVideoIndex === index ? 'batch-video-item-editing' : ''}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="batch-video-title" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {video.name || `Video ${index + 1}`}
                      </div>
                      <div className="batch-video-description" style={{ fontSize: '12px' }}>
                        {video.text ? `Text: ${video.text.substring(0, 50)}${video.text.length > 50 ? '...' : ''}` : 'No text'}
                        {video.imagePath && ' | Has image'}
                        {video.videoPath && ' | Has video'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditBatchVideo(index)}
                        disabled={isGenerating}
                        className="small-btn"
                        style={{ padding: '6px 12px' }}
                      >
                        ✏️ Edit
                      </button>
                      {editingBatchVideoIndex === index && (
                        <button
                          onClick={handleSaveBatchVideo}
                          disabled={isGenerating}
                          className="small-btn"
                          style={{ padding: '6px 12px', backgroundColor: '#4caf50', color: 'white' }}
                        >
                          💾 Save
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {editingBatchVideoIndex !== null && (
                <p style={{ fontSize: '12px', color: '#2196f3', marginTop: '12px', fontStyle: 'italic' }}>
                  📝 Currently editing Video {editingBatchVideoIndex + 1}. Go to Basic Settings tab to configure.
                </p>
              )}
            </div>
          )}

          {batchVideos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <p>No videos created yet. Select single or multiple mode above and click "Create Videos".</p>
            </div>
          )}
        </div>
      )}

      {/* Basic Settings */}
      {activeSettingsTab === 'basic' && (
        <div className="section-content">
          {/* Batch Video Editing Indicator */}
          {editingBatchVideoIndex !== null && (
            <div style={{
              padding: '12px',
              backgroundColor: '#e3f2fd',
              border: '2px solid #2196f3',
              borderRadius: '4px',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: '4px' }}>
                📝 Editing Batch Video {editingBatchVideoIndex + 1}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Configure settings below. Click "Save Batch Video" when done, or go back to Batch Videos tab.
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="form-group">
            <div className="button-group-full">
              {editingBatchVideoIndex !== null ? (
                <>
                  <button onClick={handleSaveBatchVideo} disabled={isGenerating} className="small-btn" style={{ backgroundColor: '#4caf50', color: 'white' }}>
                    💾 Save Batch Video
                  </button>
                  <button onClick={handleBackToBatchVideos} disabled={isGenerating} className="small-btn">
                    ← Back to Batch Videos
                  </button>
                  <button onClick={handleLoadProject} disabled={isGenerating} className="small-btn">
                    📂 Load Project
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleSaveProject} disabled={isGenerating} className="small-btn">
                    💾 Save Project
                  </button>
                  <button onClick={handleLoadProject} disabled={isGenerating} className="small-btn">
                    📂 Load Project
                  </button>
                </>
              )}
              <button onClick={handleSelectImage} disabled={isGenerating} className="small-btn">
                📸 Single Image
              </button>
              <button onClick={handleSelectMultipleImages} disabled={isGenerating} className="small-btn">
                📷 Multiple Images
              </button>
              <button onClick={handleSelectVideo} disabled={isGenerating} className="small-btn">
                🎥 Video Background
              </button>
            </div>
            {imagePath && <p className="file-info">Selected: {imagePath.split(/[/\\]/).pop()}</p>}
            {imagePaths.length > 0 && <p className="file-info">Selected: {imagePaths.length} images</p>}
            {videoPath && <p className="file-info">Video: {videoPath.split(/[/\\]/).pop()}</p>}
          </div>

          {/* Social Media Presets */}
          <div className="form-group">
            <label>Social Media Preset</label>
            <select value={socialPreset} onChange={(e) => handleSocialPreset(e.target.value)} disabled={isGenerating}>
              {socialPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Text Input */}
          <div className="form-group">
            <label>Scrolling Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text here..."
              rows={6}
              disabled={isGenerating}
            />
          </div>

          {/* Video Settings - All in One Row */}
          <div className="form-row-five">
            <div className="form-group">
              <label>Width (px)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min="1"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Height (px)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="1"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Scroll Speed (px/s)</label>
              <input
                type="number"
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(e.target.value)}
                min="1"
                step="10"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Scroll Direction</label>
              <select value={scrollDirection} onChange={(e) => setScrollDirection(e.target.value)} disabled={isGenerating}>
                {scrollDirections.map((dir) => (
                  <option key={dir.value} value={dir.value}>
                    {dir.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>FPS</label>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                min="1"
                max="60"
                disabled={isGenerating}
              />
            </div>
          </div>
        </div>
      )}

      {/* Text Effects */}
      {activeSettingsTab === 'textEffects' && (
        <div className="section-content">
          <div className="form-row-four">
            <div className="form-group">
              <label>Text Color</label>
              <div className="color-input-wrapper">
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} disabled={isGenerating} />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  disabled={isGenerating}
                  className="color-text"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Font Size (px)</label>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                min="1"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Font Family</label>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} disabled={isGenerating}>
                {fontFamilies.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Text Animation</label>
              <select
                value={textAnimation.type}
                onChange={(e) => setTextAnimation({ type: e.target.value })}
                disabled={isGenerating}
              >
                {animationTypes.map((anim) => (
                  <option key={anim.value} value={anim.value}>
                    {anim.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkboxes in One Row */}
          <div className="form-row-five">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={textEffects.bold}
                onChange={(e) => setTextEffects((prev) => ({ ...prev, bold: e.target.checked }))}
                disabled={isGenerating}
              />
              Bold
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={textEffects.italic}
                onChange={(e) => setTextEffects((prev) => ({ ...prev, italic: e.target.checked }))}
                disabled={isGenerating}
              />
              Italic
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={textEffects.underline}
                onChange={(e) => setTextEffects((prev) => ({ ...prev, underline: e.target.checked }))}
                disabled={isGenerating}
              />
              Underline
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={textEffects.outline.enabled}
                onChange={(e) =>
                  setTextEffects((prev) => ({
                    ...prev,
                    outline: { ...prev.outline, enabled: e.target.checked },
                  }))
                }
                disabled={isGenerating}
              />
              Text Outline
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={textEffects.shadow.enabled}
                onChange={(e) =>
                  setTextEffects((prev) => ({
                    ...prev,
                    shadow: { ...prev.shadow, enabled: e.target.checked },
                  }))
                }
                disabled={isGenerating}
              />
              Drop Shadow
            </label>
          </div>

          {/* Text Outline Settings */}
          {textEffects.outline.enabled && (
            <div className="form-row">
              <div className="form-group">
                <label>Outline Color</label>
                <input
                  type="color"
                  value={textEffects.outline.color}
                  onChange={(e) =>
                    setTextEffects((prev) => ({
                      ...prev,
                      outline: { ...prev.outline, color: e.target.value },
                    }))
                  }
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label>Outline Width</label>
                <input
                  type="number"
                  value={textEffects.outline.width}
                  onChange={(e) =>
                    setTextEffects((prev) => ({
                      ...prev,
                      outline: { ...prev.outline, width: parseInt(e.target.value) },
                    }))
                  }
                  min="1"
                  max="10"
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}

          {/* Drop Shadow Settings */}
          {textEffects.shadow.enabled && (
            <div className="form-row">
              <div className="form-group">
                <label>Shadow Color</label>
                <input
                  type="color"
                  value={textEffects.shadow.color}
                  onChange={(e) =>
                    setTextEffects((prev) => ({
                      ...prev,
                      shadow: { ...prev.shadow, color: e.target.value },
                    }))
                  }
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label>Blur</label>
                <input
                  type="number"
                  value={textEffects.shadow.blur}
                  onChange={(e) =>
                    setTextEffects((prev) => ({
                      ...prev,
                      shadow: { ...prev.shadow, blur: parseInt(e.target.value) },
                    }))
                  }
                  min="0"
                  max="50"
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Background Settings */}
      {activeSettingsTab === 'background' && (
        <div className="section-content">
          {/* Image Filter, Rotation, and Gradient in One Row */}
          <div className="form-row-three">
            <div className="form-group">
              <label>Image Filter</label>
              <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value)} disabled={isGenerating}>
                {imageFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Rotation (degrees)</label>
              <input
                type="number"
                value={backgroundRotation}
                onChange={(e) => setBackgroundRotation(parseInt(e.target.value))}
                min="-360"
                max="360"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Use Gradient Background</label>
              <label className="checkbox-label" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={backgroundGradient.enabled}
                  onChange={(e) =>
                    setBackgroundGradient((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  disabled={isGenerating}
                />
              </label>
            </div>
          </div>

          {/* Overlay Opacity and Brightness in One Row */}
          <div className="form-row">
            <div className="form-group">
              <label>Overlay Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                disabled={isGenerating}
                style={{ ['--range-progress']: `${(overlayOpacity / 1) * 100}%` }}
              />
              <span>{Math.round(overlayOpacity * 100)}%</span>
            </div>
            <div className="form-group">
              <label>Brightness</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={colorAdjustments.brightness}
                onChange={(e) =>
                  setColorAdjustments((prev) => ({
                    ...prev,
                    brightness: parseFloat(e.target.value),
                  }))
                }
                disabled={isGenerating}
                style={{ ['--range-progress']: `${(colorAdjustments.brightness / 2) * 100}%` }}
              />
              <span>{Math.round(colorAdjustments.brightness * 100)}%</span>
            </div>
          </div>

          {/* Contrast and Saturation in Next Row */}
          <div className="form-row">
            <div className="form-group">
              <label>Contrast</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={colorAdjustments.contrast}
                onChange={(e) =>
                  setColorAdjustments((prev) => ({
                    ...prev,
                    contrast: parseFloat(e.target.value),
                  }))
                }
                disabled={isGenerating}
                style={{ ['--range-progress']: `${(colorAdjustments.contrast / 2) * 100}%` }}
              />
              <span>{Math.round(colorAdjustments.contrast * 100)}%</span>
            </div>
            <div className="form-group">
              <label>Saturation</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={colorAdjustments.saturation}
                onChange={(e) =>
                  setColorAdjustments((prev) => ({
                    ...prev,
                    saturation: parseFloat(e.target.value),
                  }))
                }
                disabled={isGenerating}
                style={{ ['--range-progress']: `${(colorAdjustments.saturation / 2) * 100}%` }}
              />
              <span>{Math.round(colorAdjustments.saturation * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Audio Settings */}
      {activeSettingsTab === 'audio' && (
        <div className="section-content">
          <div className="form-group">
            <label>Narration Audio (TTS)</label>
            <textarea
              value={audioText}
              onChange={(e) => setAudioText(e.target.value)}
              placeholder="Enter narration text for text-to-speech..."
              rows={4}
              disabled={isGenerating}
            />
          </div>

          {/* Voice Provider */}
          <div className="form-group">
            <label>Voice Provider</label>
            <select value={audioProvider} onChange={(e) => setAudioProvider(e.target.value)} disabled={isGenerating}>
              <option value="google">Google TTS (Online)</option>
              <option value="system">System Voices (Offline)</option>
              <option value="xtts">XTTS (Bundled Offline)</option>
            </select>
            <small style={{ color: '#666', fontSize: '11px' }}>
              “System Voices” uses voices installed on your PC (no subscription). “XTTS” uses a bundled local XTTS server + model files.
            </small>
          </div>

          {/* Voice Language / Voice selection + Background Music */}
          <div className="form-row audio-controls-row">
            <div className="form-group">
              {audioProvider === 'xtts' ? (
                <>
                  <label>XTTS Voice</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedXttsVoiceId}
                      onChange={(e) => setSelectedXttsVoiceId(e.target.value)}
                      disabled={isGenerating || xttsVoicesLoading || !xttsVoices || xttsVoices.length === 0}
                      className="audio-control-select"
                      style={{
                        opacity: xttsVoicesLoading ? 0.6 : 1,
                        backgroundImage: xttsVoicesLoading 
                          ? 'none' 
                          : undefined,
                      }}
                    >
                      {xttsVoicesLoading ? (
                        <option value="">Loading voices...</option>
                      ) : xttsVoices && xttsVoices.length > 0 ? (
                        xttsVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label || v.id}
                          </option>
                        ))
                      ) : (
                        <option value="">No XTTS voices found</option>
                      )}
                    </select>
                    {xttsVoicesLoading && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '30px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                          width: '16px',
                          height: '16px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid #f3f3f3',
                            borderTop: '2px solid #4a90e2',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {xttsVoicesError ? (
                    <small style={{ color: '#b00020', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      XTTS error: {xttsVoicesError}
                    </small>
                  ) : null}
                </>
              ) : audioProvider === 'system' ? (
                <>
                  <label>Voice</label>
                  <select
                    value={selectedTtsVoiceName}
                    onChange={(e) => setSelectedTtsVoiceName(e.target.value)}
                    disabled={isGenerating || !ttsVoices || ttsVoices.length === 0}
                    className="audio-control-select"
                  >
                    {ttsVoices && ttsVoices.length > 0 ? (
                      ttsVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                          {v.culture ? ` (${v.culture})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">No system voices found</option>
                    )}
                  </select>
                </>
              ) : (
                <>
                  <label>Voice Language</label>
                  <select
                    value={audioLanguage}
                    onChange={(e) => setAudioLanguage(e.target.value)}
                    disabled={isGenerating}
                    className="audio-control-select"
                  >
                    {narrationLanguages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="form-group">
              <label>Background Music</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={backgroundMusic.path ? backgroundMusic.path.split(/[/\\]/).pop() : ''}
                  placeholder="No audio file selected"
                  readOnly
                  style={{ flex: 1 }}
                />
                <button onClick={handleSelectAudio} disabled={isGenerating} className="small-btn">
                  🎵 Select Audio File
                </button>
                {backgroundMusic.path && (
                  <button onClick={handleRemoveAudio} disabled={isGenerating} className="small-btn" style={{ backgroundColor: '#f44336', color: 'white' }}>
                    ❌ Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {backgroundMusic.enabled && (
            <div className="form-row">
              <div className="form-group">
                <label>Volume (0-1)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={backgroundMusic.volume}
                  onChange={(e) =>
                    setBackgroundMusic((prev) => ({
                      ...prev,
                      volume: parseFloat(e.target.value),
                    }))
                  }
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label>Fade In (seconds)</label>
                <input
                  type="number"
                  value={backgroundMusic.fadeIn}
                  onChange={(e) =>
                    setBackgroundMusic((prev) => ({
                      ...prev,
                      fadeIn: parseFloat(e.target.value),
                    }))
                  }
                  min="0"
                  step="0.5"
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label>Fade Out (seconds)</label>
                <input
                  type="number"
                  value={backgroundMusic.fadeOut}
                  onChange={(e) =>
                    setBackgroundMusic((prev) => ({
                      ...prev,
                      fadeOut: parseFloat(e.target.value),
                    }))
                  }
                  min="0"
                  step="0.5"
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Quality & Export */}
      {activeSettingsTab === 'quality' && (
        <div className="section-content">
          <div className="form-row">
            <div className="form-group">
              <label>Export Format</label>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} disabled={isGenerating}>
                {exportFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quality Preset</label>
              <select value={qualityPreset} onChange={(e) => setQualityPreset(e.target.value)} disabled={isGenerating}>
                {qualityPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Bitrate and Output Directory in One Row */}
          <div className="form-row">
            <div className="form-group">
              <label>Custom Bitrate (kbps, optional)</label>
              <input
                type="number"
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                placeholder="Leave empty for preset quality"
                disabled={isGenerating}
              />
            </div>
            <div className="form-group">
              <label>Output Directory</label>
              <div className="input-with-button">
                <input type="text" value={outputDirectory || 'Desktop (default)'} placeholder="Desktop (default)" readOnly />
                <button onClick={handleSelectOutputDirectory} disabled={isGenerating}>
                  📁 Choose
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Additional Exports</label>
            <div className="form-row-three exports-checkboxes">
              <label className="checkbox-label" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={exportGif} onChange={(e) => setExportGif(e.target.checked)} disabled={isGenerating} />
                Export as GIF
              </label>
              <label className="checkbox-label" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={exportImageSequence}
                  onChange={(e) => setExportImageSequence(e.target.checked)}
                  disabled={isGenerating}
                />
                Export Image Sequence
              </label>
              <label className="checkbox-label" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={exportThumbnail}
                  onChange={(e) => setExportThumbnail(e.target.checked)}
                  disabled={isGenerating}
                />
                Generate Thumbnail
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button className="generate-button" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? '⏳ Generating...' : '🎥 Generate Video'}
      </button>

      {/* Progress Bars - Separate for Audio and Video */}
      {isGenerating && (
        <div className="progress-section">
          {/* Audio Progress Bar (only show if narration is enabled) */}
          {audioText && audioText.trim().length > 0 && (
            <div className="progress-item">
              <div className="progress-label" style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#4a90e2' }}>
                🎙️ Audio Generation
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${audioProgress}%`, 
                    background: 'linear-gradient(90deg, #4a90e2 0%, #357abd 100%)'
                  }}
                >
                  <span className="progress-text">{Math.round(audioProgress)}%</span>
                </div>
              </div>
              {audioProgressMessage && (
                <p className="progress-message" style={{ fontSize: '11px', marginTop: '2px', marginBottom: '8px' }}>
                  {audioProgressMessage}
                </p>
              )}
            </div>
          )}
          
          {/* Video Progress Bar */}
          <div className="progress-item">
            <div className="progress-label" style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#e74c3c' }}>
              🎬 Video Generation
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${videoProgress}%`, 
                  background: 'linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)'
                }}
              >
                <span className="progress-text">{Math.round(videoProgress)}%</span>
              </div>
            </div>
            {videoProgressMessage && (
              <p className="progress-message" style={{ fontSize: '11px', marginTop: '2px', marginBottom: '8px' }}>
                {videoProgressMessage}
              </p>
            )}
          </div>
          
          {/* Overall Timing */}
          <div className="progress-timing" style={{ marginTop: '8px' }}>
            <span>Elapsed: {formatClock(scrollingElapsedSec)}</span>
            {scrollingEtaSec != null && progress > 0 && progress < 100 ? (
              <span>ETA: {formatClock(scrollingEtaSec)}</span>
            ) : (
              <span />
            )}
          </div>
          
          <div className="cancel-button-container">
            <button onClick={handleCancel} className="cancel-button">
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status Message */}
      {scrollingStatus && <p className="status-message">{scrollingStatus}</p>}
    </div>
  );
}


