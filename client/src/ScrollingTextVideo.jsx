import React, { useState, useEffect } from 'react';
import './ScrollingTextVideo.css';

function ScrollingTextVideo() {
  // Basic state
  const [imagePath, setImagePath] = useState('');
  const [imagePaths, setImagePaths] = useState([]);
  const [videoPath, setVideoPath] = useState('');
  const [text, setText] = useState('');
  const [texts, setTexts] = useState([{ text: '', x: null, y: null }]);
  const [audioText, setAudioText] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('en');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [scrollSpeed, setScrollSpeed] = useState(100);
  const [scrollDirection, setScrollDirection] = useState('vertical');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fps, setFps] = useState(30);
  
  // Text effects
  const [textEffects, setTextEffects] = useState({
    bold: false,
    italic: false,
    underline: false,
    outline: { enabled: false, color: '#000000', width: 2 },
    shadow: { enabled: false, color: 'rgba(0, 0, 0, 0.5)', blur: 10, offsetX: 0, offsetY: 2 },
    gradient: { enabled: false, colors: ['#ffffff', '#000000'] },
  });

  // Text animation
  const [textAnimation, setTextAnimation] = useState({ type: 'none' });

  // Background
  const [backgroundGradient, setBackgroundGradient] = useState({ enabled: false, colors: ['#000000', '#ffffff'] });
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);
  const [imageFilter, setImageFilter] = useState('none');
  const [colorAdjustments, setColorAdjustments] = useState({ brightness: 1, contrast: 1, saturation: 1, hue: 0 });
  const [backgroundCrop, setBackgroundCrop] = useState({ enabled: false, x: 0, y: 0, width: null, height: null });
  const [backgroundRotation, setBackgroundRotation] = useState(0);

  // Audio
  const [backgroundMusic, setBackgroundMusic] = useState({ enabled: false, path: '', volume: 0.5, fadeIn: 0, fadeOut: 0 });

  // Multi-slide
  const [slides, setSlides] = useState([]);
  const [useMultiSlide, setUseMultiSlide] = useState(false);

  // Video quality
  const [exportFormat, setExportFormat] = useState('mp4');
  const [qualityPreset, setQualityPreset] = useState('high');
  const [bitrate, setBitrate] = useState('');
  const [outputDirectory, setOutputDirectory] = useState('');

  // Export options
  const [exportGif, setExportGif] = useState(false);
  const [exportImageSequence, setExportImageSequence] = useState(false);
  const [exportThumbnail, setExportThumbnail] = useState(false);

  // Subtitles
  const [subtitles, setSubtitles] = useState({ enabled: false, items: [], filePath: '' });

  // Social media presets
  const [socialPreset, setSocialPreset] = useState('custom');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [status, setStatus] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    textEffects: false,
    background: false,
    audio: false,
    multiSlide: false,
    quality: false,
    export: false,
    subtitles: false,
    social: false,
  });

  useEffect(() => {
    window.electronAPI.onScrollingVideoProgress((progressData) => {
      const canUpdateProgress =
        typeof progressData.progress === 'number' && !Number.isNaN(progressData.progress);

      if (progressData.type === 'frame' || progressData.type === 'batch') {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
        }
        setProgressMessage(progressData.message || `Processing: ${progressData.current}/${progressData.total}`);
      } else if (progressData.type === 'encoding') {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
        }
        setProgressMessage(progressData.message || 'Encoding video...');
      } else if (progressData.type === 'audio') {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
        }
        setProgressMessage(progressData.message || 'Generating narration audio...');
      } else if (progressData.type === 'audio-mix') {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
        }
        setProgressMessage(progressData.message || 'Mixing audio with video...');
      } else if (progressData.message) {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
        }
        setProgressMessage(progressData.message);
      }
    });

    window.electronAPI.onScrollingVideoDone((path) => {
      setIsGenerating(false);
      setProgress(100);
      setProgressMessage('');
      setStatus(`✅ Video created successfully: ${path}`);
    });

    window.electronAPI.onScrollingVideoError((error) => {
      setIsGenerating(false);
      setProgress(0);
      setProgressMessage('');
      setStatus(`❌ Error: ${error}`);
    });

    return () => {
      window.electronAPI.removeScrollingVideoListeners();
    };
  }, []);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSelectImage = async () => {
    const path = await window.electronAPI.selectSingleImage();
    if (path) {
      setImagePath(path);
      setStatus('');
    }
  };

  const handleSelectMultipleImages = async () => {
    const paths = await window.electronAPI.selectMultipleImages();
    if (paths && paths.length > 0) {
      setImagePaths(paths);
      setStatus('');
    }
  };

  const handleSelectVideo = async () => {
    const path = await window.electronAPI.selectVideo();
    if (path) {
      setVideoPath(path);
      setStatus('');
    }
  };

  const handleSelectAudio = async () => {
    const path = await window.electronAPI.selectAudio();
    if (path) {
      setBackgroundMusic(prev => ({ ...prev, path, enabled: true }));
      setStatus('');
    }
  };

  const handleSelectSubtitle = async () => {
    const path = await window.electronAPI.selectSubtitle();
    if (path) {
      // Parse SRT/VTT file
      try {
        const subtitleData = await window.electronAPI.readBatchFile(path);
        setSubtitles({
          enabled: true,
          filePath: path,
          items: subtitleData.items || subtitleData || [],
        });
        setStatus(`✅ Subtitle file loaded: ${subtitleData.items?.length || 0} subtitles`);
      } catch (error) {
        setStatus(`❌ Failed to load subtitle file: ${error.message}`);
      }
    }
  };

  const handleSelectOutputDirectory = async () => {
    const path = await window.electronAPI.selectOutputDirectory();
    if (path) {
      setOutputDirectory(path);
      setStatus('');
    }
  };

  const handleSocialPreset = (preset) => {
    setSocialPreset(preset);
    const presets = {
      instagram: { width: 1080, height: 1080 },
      'instagram-story': { width: 1080, height: 1920 },
      'instagram-reel': { width: 1080, height: 1920 },
      tiktok: { width: 1080, height: 1920 },
      'youtube-shorts': { width: 1080, height: 1920 },
      youtube: { width: 1920, height: 1080 },
      facebook: { width: 1280, height: 720 },
      twitter: { width: 1280, height: 720 },
      custom: { width: 1920, height: 1080 },
    };
    if (presets[preset]) {
      setWidth(presets[preset].width);
      setHeight(presets[preset].height);
    }
  };

  const handleSaveProject = async () => {
    const config = buildConfig();
    try {
      const path = await window.electronAPI.saveProject(config);
      setStatus(`✅ Project saved: ${path}`);
    } catch (error) {
      setStatus(`❌ Failed to save project: ${error.message}`);
    }
  };

  const handleLoadProject = async () => {
    try {
      const config = await window.electronAPI.loadProject();
      loadConfig(config);
      setStatus(`✅ Project loaded successfully`);
    } catch (error) {
      setStatus(`❌ Failed to load project: ${error.message}`);
    }
  };

  const buildConfig = () => {
    return {
      imagePath,
      imagePaths: imagePaths.length > 0 ? imagePaths : null,
      videoPath: videoPath || null,
      text,
      texts: texts.length > 1 || texts[0].text ? texts : null,
      width: parseInt(width),
      height: parseInt(height),
      scrollSpeed: parseFloat(scrollSpeed),
      scrollDirection,
      textColor,
      fontSize: parseInt(fontSize),
      fontFamily,
      fps: parseInt(fps),
      textEffects,
      textAnimation,
      backgroundGradient,
      overlayOpacity,
      imageFilter,
      colorAdjustments,
      backgroundCrop,
      backgroundRotation,
      backgroundMusic,
      slides: useMultiSlide && slides.length > 0 ? slides : null,
      exportFormat,
      qualityPreset,
      bitrate: bitrate ? parseInt(bitrate) : null,
      outputDirectory: outputDirectory || null,
      exportGif,
      exportImageSequence,
      exportThumbnail,
      subtitles,
      narration: {
        enabled: audioText.trim().length > 0,
        text: audioText.trim(),
        language: audioLanguage,
      },
    };
  };

  const loadConfig = (config) => {
    if (config.imagePath) setImagePath(config.imagePath);
    if (config.imagePaths) setImagePaths(config.imagePaths);
    if (config.videoPath) setVideoPath(config.videoPath);
    if (config.text) setText(config.text);
    if (config.texts) setTexts(config.texts);
    if (config.width) setWidth(config.width);
    if (config.height) setHeight(config.height);
    if (config.scrollSpeed) setScrollSpeed(config.scrollSpeed);
    if (config.scrollDirection) setScrollDirection(config.scrollDirection);
    if (config.textColor) setTextColor(config.textColor);
    if (config.fontSize) setFontSize(config.fontSize);
    if (config.fontFamily) setFontFamily(config.fontFamily);
    if (config.fps) setFps(config.fps);
    if (config.textEffects) setTextEffects(config.textEffects);
    if (config.textAnimation) setTextAnimation(config.textAnimation);
    if (config.backgroundGradient) setBackgroundGradient(config.backgroundGradient);
    if (config.overlayOpacity !== undefined) setOverlayOpacity(config.overlayOpacity);
    if (config.imageFilter) setImageFilter(config.imageFilter);
    if (config.colorAdjustments) setColorAdjustments(config.colorAdjustments);
    if (config.backgroundCrop) setBackgroundCrop(config.backgroundCrop);
    if (config.backgroundRotation) setBackgroundRotation(config.backgroundRotation);
    if (config.backgroundMusic) setBackgroundMusic(config.backgroundMusic);
    if (config.slides) {
      setSlides(config.slides);
      setUseMultiSlide(true);
    }
    if (config.exportFormat) setExportFormat(config.exportFormat);
    if (config.qualityPreset) setQualityPreset(config.qualityPreset);
    if (config.bitrate) setBitrate(config.bitrate.toString());
    if (config.outputDirectory) setOutputDirectory(config.outputDirectory);
    if (config.exportGif !== undefined) setExportGif(config.exportGif);
    if (config.exportImageSequence !== undefined) setExportImageSequence(config.exportImageSequence);
    if (config.exportThumbnail !== undefined) setExportThumbnail(config.exportThumbnail);
    if (config.subtitles) setSubtitles(config.subtitles);
    if (config.narration && config.narration.text) {
      setAudioText(config.narration.text);
      if (config.narration.language) setAudioLanguage(config.narration.language);
    }
  };

  const handleGenerate = () => {
    // Validation
    if (!imagePath && imagePaths.length === 0 && !videoPath && !backgroundGradient.enabled) {
      setStatus('❌ Please select a background image, video, or enable gradient background');
      return;
    }

    if (!text.trim() && (!texts || texts.every(t => !t.text || !t.text.trim()))) {
      setStatus('❌ Please enter text to scroll');
      return;
    }

    if (width <= 0 || height <= 0) {
      setStatus('❌ Width and height must be greater than 0');
      return;
    }

    if (scrollSpeed <= 0) {
      setStatus('❌ Scroll speed must be greater than 0');
      return;
    }

    if (fontSize <= 0) {
      setStatus('❌ Font size must be greater than 0');
      return;
    }

    // Start generation
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Initializing...');
    setStatus('🎬 Generating video...');

    const options = buildConfig();
    window.electronAPI.generateScrollingVideo(options);
  };

  const fontFamilies = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
    'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Palatino',
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Raleway',
  ];

  const narrationLanguages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ar', label: 'Arabic' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
  ];

  const animationTypes = [
    { value: 'none', label: 'None' },
    { value: 'fade-in', label: 'Fade In' },
    { value: 'fade-out', label: 'Fade Out' },
    { value: 'fade-both', label: 'Fade In & Out' },
    { value: 'zoom-in', label: 'Zoom In' },
    { value: 'zoom-out', label: 'Zoom Out' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'bounce', label: 'Bounce' },
  ];

  const scrollDirections = [
    { value: 'vertical', label: 'Vertical (Bottom to Top)' },
    { value: 'horizontal', label: 'Horizontal (Right to Left)' },
    { value: 'diagonal', label: 'Diagonal' },
    { value: 'fixed', label: 'Fixed Position' },
  ];

  const imageFilters = [
    { value: 'none', label: 'None' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'black-white', label: 'Black & White' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'bright', label: 'Bright' },
    { value: 'dark', label: 'Dark' },
  ];

  const qualityPresets = [
    { value: 'low', label: 'Low (Fast, Larger File)' },
    { value: 'medium', label: 'Medium (Balanced)' },
    { value: 'high', label: 'High (Recommended)' },
    { value: 'ultra', label: 'Ultra (Best Quality, Slower)' },
  ];

  const exportFormats = [
    { value: 'mp4', label: 'MP4 (Recommended)' },
    { value: 'mov', label: 'MOV (Apple)' },
    { value: 'webm', label: 'WebM (Web)' },
  ];

  const socialPresets = [
    { value: 'custom', label: 'Custom' },
    { value: 'instagram', label: 'Instagram Post (1:1)' },
    { value: 'instagram-story', label: 'Instagram Story (9:16)' },
    { value: 'instagram-reel', label: 'Instagram Reel (9:16)' },
    { value: 'tiktok', label: 'TikTok (9:16)' },
    { value: 'youtube-shorts', label: 'YouTube Shorts (9:16)' },
    { value: 'youtube', label: 'YouTube (16:9)' },
    { value: 'facebook', label: 'Facebook (16:9)' },
    { value: 'twitter', label: 'Twitter (16:9)' },
  ];

  return (
    <div className="scrolling-video-container">
      <div className="header-section">
        <h1>📜 Advanced Video Generator</h1>
        <div className="header-buttons">
          <button onClick={handleSaveProject} disabled={isGenerating} className="header-btn">
            💾 Save Project
          </button>
          <button onClick={handleLoadProject} disabled={isGenerating} className="header-btn">
            📂 Load Project
          </button>
        </div>
      </div>

      <div className="form-section">
        {/* Basic Settings */}
        <div className="section-header" onClick={() => toggleSection('basic')}>
          <h2>⚙️ Basic Settings {expandedSections.basic ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.basic && (
          <div className="section-content">
            {/* Social Media Presets */}
            <div className="form-group">
              <label>Social Media Preset</label>
              <select
                value={socialPreset}
                onChange={(e) => handleSocialPreset(e.target.value)}
                disabled={isGenerating}
              >
                {socialPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Selection */}
            <div className="form-group">
              <label>Background</label>
              <div className="button-group">
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
              {imagePath && (
                <p className="file-info">Selected: {imagePath.split(/[/\\]/).pop()}</p>
              )}
              {imagePaths.length > 0 && (
                <p className="file-info">Selected: {imagePaths.length} images</p>
              )}
              {videoPath && (
                <p className="file-info">Video: {videoPath.split(/[/\\]/).pop()}</p>
              )}
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

            {/* Video Dimensions */}
            <div className="form-row">
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
            </div>

            {/* Scroll Settings */}
            <div className="form-row">
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
                <select
                  value={scrollDirection}
                  onChange={(e) => setScrollDirection(e.target.value)}
                  disabled={isGenerating}
                >
                  {scrollDirections.map((dir) => (
                    <option key={dir.value} value={dir.value}>
                      {dir.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* FPS */}
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
        )}

        {/* Text Effects */}
        <div className="section-header" onClick={() => toggleSection('textEffects')}>
          <h2>✨ Text Effects {expandedSections.textEffects ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.textEffects && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group">
                <label>Text Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    disabled={isGenerating}
                  />
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
            </div>

            <div className="form-group">
              <label>Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                disabled={isGenerating}
              >
                {fontFamilies.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textEffects.bold}
                  onChange={(e) => setTextEffects(prev => ({ ...prev, bold: e.target.checked }))}
                  disabled={isGenerating}
                />
                Bold
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textEffects.italic}
                  onChange={(e) => setTextEffects(prev => ({ ...prev, italic: e.target.checked }))}
                  disabled={isGenerating}
                />
                Italic
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textEffects.underline}
                  onChange={(e) => setTextEffects(prev => ({ ...prev, underline: e.target.checked }))}
                  disabled={isGenerating}
                />
                Underline
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textEffects.outline.enabled}
                  onChange={(e) => setTextEffects(prev => ({
                    ...prev,
                    outline: { ...prev.outline, enabled: e.target.checked }
                  }))}
                  disabled={isGenerating}
                />
                Text Outline
              </label>
              {textEffects.outline.enabled && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Outline Color</label>
                    <input
                      type="color"
                      value={textEffects.outline.color}
                      onChange={(e) => setTextEffects(prev => ({
                        ...prev,
                        outline: { ...prev.outline, color: e.target.value }
                      }))}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="form-group">
                    <label>Outline Width</label>
                    <input
                      type="number"
                      value={textEffects.outline.width}
                      onChange={(e) => setTextEffects(prev => ({
                        ...prev,
                        outline: { ...prev.outline, width: parseInt(e.target.value) }
                      }))}
                      min="1"
                      max="10"
                      disabled={isGenerating}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textEffects.shadow.enabled}
                  onChange={(e) => setTextEffects(prev => ({
                    ...prev,
                    shadow: { ...prev.shadow, enabled: e.target.checked }
                  }))}
                  disabled={isGenerating}
                />
                Drop Shadow
              </label>
              {textEffects.shadow.enabled && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Shadow Color</label>
                    <input
                      type="color"
                      value={textEffects.shadow.color}
                      onChange={(e) => setTextEffects(prev => ({
                        ...prev,
                        shadow: { ...prev.shadow, color: e.target.value }
                      }))}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="form-group">
                    <label>Blur</label>
                    <input
                      type="number"
                      value={textEffects.shadow.blur}
                      onChange={(e) => setTextEffects(prev => ({
                        ...prev,
                        shadow: { ...prev.shadow, blur: parseInt(e.target.value) }
                      }))}
                      min="0"
                      max="50"
                      disabled={isGenerating}
                    />
                  </div>
                </div>
              )}
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
        )}

        {/* Background Settings */}
        <div className="section-header" onClick={() => toggleSection('background')}>
          <h2>🖼️ Background Settings {expandedSections.background ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.background && (
          <div className="section-content">
            <div className="form-group">
              <label>Image Filter</label>
              <select
                value={imageFilter}
                onChange={(e) => setImageFilter(e.target.value)}
                disabled={isGenerating}
              >
                {imageFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Overlay Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                disabled={isGenerating}
              />
              <span>{Math.round(overlayOpacity * 100)}%</span>
            </div>

            <div className="form-group">
              <label>Color Adjustments</label>
              <div className="form-row">
                <div className="form-group">
                  <label>Brightness</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={colorAdjustments.brightness}
                    onChange={(e) => setColorAdjustments(prev => ({
                      ...prev,
                      brightness: parseFloat(e.target.value)
                    }))}
                    disabled={isGenerating}
                  />
                </div>
                <div className="form-group">
                  <label>Contrast</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={colorAdjustments.contrast}
                    onChange={(e) => setColorAdjustments(prev => ({
                      ...prev,
                      contrast: parseFloat(e.target.value)
                    }))}
                    disabled={isGenerating}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Saturation</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={colorAdjustments.saturation}
                    onChange={(e) => setColorAdjustments(prev => ({
                      ...prev,
                      saturation: parseFloat(e.target.value)
                    }))}
                    disabled={isGenerating}
                  />
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
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={backgroundGradient.enabled}
                  onChange={(e) => setBackgroundGradient(prev => ({
                    ...prev,
                    enabled: e.target.checked
                  }))}
                  disabled={isGenerating}
                />
                Use Gradient Background
              </label>
            </div>
          </div>
        )}

        {/* Audio Settings */}
        <div className="section-header" onClick={() => toggleSection('audio')}>
          <h2>🎵 Audio Settings {expandedSections.audio ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.audio && (
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
              <div className="form-row">
                <div className="form-group">
                  <label>Voice Language</label>
                  <select
                    value={audioLanguage}
                    onChange={(e) => setAudioLanguage(e.target.value)}
                    disabled={isGenerating}
                  >
                    {narrationLanguages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Background Music</label>
              <div className="button-group">
                <button onClick={handleSelectAudio} disabled={isGenerating} className="small-btn">
                  🎵 Select Audio File
                </button>
              </div>
              {backgroundMusic.path && (
                <p className="file-info">Selected: {backgroundMusic.path.split(/[/\\]/).pop()}</p>
              )}
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
                      onChange={(e) => setBackgroundMusic(prev => ({
                        ...prev,
                        volume: parseFloat(e.target.value)
                      }))}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="form-group">
                    <label>Fade In (seconds)</label>
                    <input
                      type="number"
                      value={backgroundMusic.fadeIn}
                      onChange={(e) => setBackgroundMusic(prev => ({
                        ...prev,
                        fadeIn: parseFloat(e.target.value)
                      }))}
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
                      onChange={(e) => setBackgroundMusic(prev => ({
                        ...prev,
                        fadeOut: parseFloat(e.target.value)
                      }))}
                      min="0"
                      step="0.5"
                      disabled={isGenerating}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Quality & Export */}
        <div className="section-header" onClick={() => toggleSection('quality')}>
          <h2>🎬 Video Quality & Export {expandedSections.quality ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.quality && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group">
                <label>Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  disabled={isGenerating}
                >
                  {exportFormats.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quality Preset</label>
                <select
                  value={qualityPreset}
                  onChange={(e) => setQualityPreset(e.target.value)}
                  disabled={isGenerating}
                >
                  {qualityPresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                <input
                  type="text"
                  value={outputDirectory || 'Desktop (default)'}
                  placeholder="Desktop (default)"
                  readOnly
                />
                <button onClick={handleSelectOutputDirectory} disabled={isGenerating}>
                  📁 Choose
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Additional Exports</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportGif}
                    onChange={(e) => setExportGif(e.target.checked)}
                    disabled={isGenerating}
                  />
                  Export as GIF
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportImageSequence}
                    onChange={(e) => setExportImageSequence(e.target.checked)}
                    disabled={isGenerating}
                  />
                  Export Image Sequence
                </label>
                <label className="checkbox-label">
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

        {/* Subtitles */}
        <div className="section-header" onClick={() => toggleSection('subtitles')}>
          <h2>📝 Subtitles {expandedSections.subtitles ? '▼' : '▶'}</h2>
        </div>
        {expandedSections.subtitles && (
          <div className="section-content">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subtitles.enabled}
                  onChange={(e) => setSubtitles(prev => ({ ...prev, enabled: e.target.checked }))}
                  disabled={isGenerating}
                />
                Enable Subtitles
              </label>
            </div>
            {subtitles.enabled && (
              <div className="form-group">
                <button onClick={handleSelectSubtitle} disabled={isGenerating} className="small-btn">
                  📄 Load SRT/VTT File
                </button>
                {subtitles.filePath && (
                  <p className="file-info">Loaded: {subtitles.filePath.split(/[/\\]/).pop()}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          className="generate-button"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? '⏳ Generating...' : '🎥 Generate Video'}
        </button>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              >
                <span className="progress-text">{progress}%</span>
              </div>
            </div>
            {progressMessage && (
              <p className="progress-message">{progressMessage}</p>
            )}
          </div>
        )}

        {/* Status Message */}
        {status && <p className="status-message">{status}</p>}
      </div>
    </div>
  );
}

export default ScrollingTextVideo;
