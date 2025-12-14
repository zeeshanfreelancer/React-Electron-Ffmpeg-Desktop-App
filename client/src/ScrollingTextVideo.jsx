import React, { useState, useEffect, useRef } from 'react';
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
  const [activeMainTab, setActiveMainTab] = useState('advanced');
  const [activeSettingsTab, setActiveSettingsTab] = useState('basic');

  // YouTube Upload state
  const [youtubeProfiles, setYoutubeProfiles] = useState([]);
  const [selectedYoutubeProfileId, setSelectedYoutubeProfileId] = useState('');
  const [youtubeVideoPath, setYoutubeVideoPath] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTags, setYoutubeTags] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState('private');
  const [youtubeCategory, setYoutubeCategory] = useState('22');
  const [youtubeScheduleEnabled, setYoutubeScheduleEnabled] = useState(false);
  const [youtubePublishAtLocal, setYoutubePublishAtLocal] = useState(''); // datetime-local (local time)
  const [isYoutubeUploading, setIsYoutubeUploading] = useState(false);
  const [youtubeUploadProgress, setYoutubeUploadProgress] = useState(0);
  const [youtubeUploadMessage, setYoutubeUploadMessage] = useState('');
  const [youtubeAuthenticated, setYoutubeAuthenticated] = useState(false);
  const [youtubeProfileLabel, setYoutubeProfileLabel] = useState('');
  const [youtubeCredentials, setYoutubeCredentials] = useState({ clientId: '', clientSecret: '', redirectUri: '' });
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [youtubeAuthCode, setYoutubeAuthCode] = useState('');
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);

  // Avoid stale state inside long-lived IPC listeners
  const selectedYoutubeProfileIdRef = useRef('');
  useEffect(() => {
    selectedYoutubeProfileIdRef.current = selectedYoutubeProfileId;
  }, [selectedYoutubeProfileId]);

  // Pan/Zoom Video Generator state
  const [panZoomImageFolder, setPanZoomImageFolder] = useState('');
  const [panZoomOutputFolder, setPanZoomOutputFolder] = useState('');
  const [panZoomSocialPreset, setPanZoomSocialPreset] = useState('custom');
  const [panZoomVideoWidth, setPanZoomVideoWidth] = useState(720);
  const [panZoomVideoHeight, setPanZoomVideoHeight] = useState(1280);
  const [panZoomFps, setPanZoomFps] = useState(24);
  const [panZoomImageDuration, setPanZoomImageDuration] = useState(3.2);
  const [panZoomBatchSize, setPanZoomBatchSize] = useState(5);
  const [panZoomMaxVideos, setPanZoomMaxVideos] = useState(0);
  const [panZoomShakeMagnitude, setPanZoomShakeMagnitude] = useState(3);
  const [panZoomZoomMagnitude, setPanZoomZoomMagnitude] = useState(0.05);
  const [panZoomPanMagnitude, setPanZoomPanMagnitude] = useState(30);
  const [panZoomBackgroundMusic, setPanZoomBackgroundMusic] = useState({ enabled: false, path: '', volume: 0.5, fadeIn: 0, fadeOut: 0 });
  const [isPanZoomGenerating, setIsPanZoomGenerating] = useState(false);
  const [panZoomProgress, setPanZoomProgress] = useState(0);
  const [panZoomProgressMessage, setPanZoomProgressMessage] = useState('');

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

    window.electronAPI.onScrollingVideoCancelled(() => {
      setIsGenerating(false);
      setProgress(0);
      setProgressMessage('');
      setStatus('⚠️ Video generation cancelled');
    });

    // Pan/Zoom Video Generator event listeners
    window.electronAPI.onPanZoomVideoProgress((progressData) => {
      const canUpdateProgress =
        typeof progressData.progress === 'number' && !Number.isNaN(progressData.progress);

      if (canUpdateProgress) {
        setPanZoomProgress(progressData.progress);
      }
      setPanZoomProgressMessage(progressData.message || 'Processing...');
    });

    window.electronAPI.onPanZoomVideoDone((result) => {
      setIsPanZoomGenerating(false);
      setPanZoomProgress(100);
      setPanZoomProgressMessage('');
      setStatus(`✅ Pan/Zoom videos created successfully! Total: ${result.totalVideos} videos in ${result.outputFolder}`);
    });

    window.electronAPI.onPanZoomVideoError((error) => {
      setIsPanZoomGenerating(false);
      setPanZoomProgress(0);
      setPanZoomProgressMessage('');
      setStatus(`❌ Error: ${error}`);
    });

    window.electronAPI.onPanZoomVideoCancelled(() => {
      setIsPanZoomGenerating(false);
      setPanZoomProgress(0);
      setPanZoomProgressMessage('');
      setStatus('⚠️ Video generation cancelled');
    });

    return () => {
      window.electronAPI.removeScrollingVideoListeners();
      window.electronAPI.removeYoutubeListeners();
      window.electronAPI.removePanZoomVideoListeners();
    };
  }, []);

  // YouTube Upload useEffect
  useEffect(() => {
    // Load profiles and auth status on mount
    refreshYoutubeProfiles();

    // Set up YouTube event listeners
    window.electronAPI.onYoutubeAuthUrl((payload) => {
      const url = payload && payload.url ? payload.url : payload;
      const profileId = payload && payload.profileId ? payload.profileId : '';
      if (profileId) {
        setSelectedYoutubeProfileId(profileId);
      }
      window.electronAPI.youtubeOpenUrl(url);
      setShowAuthCodeInput(true);
      setStatus('🔐 Please authorize the app in your browser. After authorization, copy the code from the URL and paste it below.');
    });

    window.electronAPI.onYoutubeAuthSuccess(async (payload) => {
      const profileId = payload && payload.profileId ? payload.profileId : '';
      if (profileId) {
        setSelectedYoutubeProfileId(profileId);
      }
      setYoutubeAuthenticated(true);
      setStatus('✅ Successfully authenticated with YouTube!');
      await refreshYoutubeProfiles(profileId);
    });

    window.electronAPI.onYoutubeProfileUpdated(async (payload) => {
      const profileId = payload && payload.profileId ? payload.profileId : '';
      await refreshYoutubeProfiles(profileId);
    });

    window.electronAPI.onYoutubeUploadProgress((progressData) => {
      setYoutubeUploadProgress(progressData.progress || 0);
      setYoutubeUploadMessage(progressData.message || 'Uploading...');
    });

    window.electronAPI.onYoutubeUploadSuccess((result) => {
      setIsYoutubeUploading(false);
      setYoutubeUploadProgress(100);
      if (result && result.scheduledPublishAt) {
        const localTime = new Date(result.scheduledPublishAt).toLocaleString();
        setStatus(`✅ Video uploaded and scheduled to publish at ${localTime}. URL: ${result.url}`);
      } else {
        setStatus(`✅ Video uploaded successfully! URL: ${result.url}`);
      }
      setYoutubeUploadMessage('');
    });

    window.electronAPI.onYoutubeUploadError((error) => {
      setIsYoutubeUploading(false);
      const errStr = String(error || '');
      let errorMessage = `❌ Upload failed: ${errStr}`;

      // Add actionable troubleshooting for common OAuth errors
      if (errStr.includes('invalid_client')) {
        errorMessage += '\n\n💡 Fix "invalid_client":\n';
        errorMessage += '1. In Google Cloud Console, create OAuth Client ID of type "Desktop app"\n';
        errorMessage += '2. Copy the correct Client ID + Client Secret into the app (no extra spaces)\n';
        errorMessage += '3. Enable "YouTube Data API v3" for the same project\n';
        errorMessage += '4. Configure OAuth consent screen (and add yourself as a Test User if in Testing)\n';
        errorMessage += '5. Click "Reset OAuth" in the app, then authenticate again\n';
        errorMessage += '\nNote: Do not use "Web application" credentials for this flow.';
      } else if (errStr.includes('invalid_grant')) {
        errorMessage += '\n\n💡 Fix "invalid_grant":\n';
        errorMessage += '1. Re-authenticate and paste a fresh code (codes expire quickly)\n';
        errorMessage += '2. Click "Reset OAuth" if it keeps happening\n';
      } else if (errStr.includes('401')) {
        errorMessage += '\n\n💡 Fix "401":\n';
        errorMessage += '1. Click "Reset OAuth" and authenticate again\n';
        errorMessage += '2. Verify your OAuth consent screen + Test User settings\n';
      }

      setStatus(errorMessage);
      setYoutubeUploadMessage('');
    });

    window.electronAPI.onYoutubeError((error) => {
      let errorMessage = `❌ YouTube Error: ${error}`;
      
      // Provide helpful messages for common errors
      if (error.includes('403') || error.includes('access_denied')) {
        errorMessage += '\n\n💡 Troubleshooting:\n';
        errorMessage += '1. Make sure OAuth consent screen is configured in Google Cloud Console\n';
        errorMessage += '2. If app is in "Testing" mode, add your email to "Test users"\n';
        errorMessage += '3. Verify redirect URI is exactly "http://localhost" (no port, no trailing slash)\n';
        errorMessage += '4. Try clearing saved credentials and re-entering them';
      } else if (error.includes('401') || error.includes('invalid_client')) {
        errorMessage += '\n\n💡 Troubleshooting:\n';
        errorMessage += '1. Verify Client ID and Client Secret are correct\n';
        errorMessage += '2. Make sure you created "Desktop app" type credentials\n';
        errorMessage += '3. Check that redirect URI matches exactly in Google Cloud Console';
      }
      
      setStatus(errorMessage);
    });

    return () => {
      window.electronAPI.removeYoutubeListeners();
    };
  }, []);

  const refreshYoutubeProfiles = async (preferredProfileId = '') => {
    try {
      const result = await window.electronAPI.youtubeListProfiles();
      const profiles = result && Array.isArray(result.profiles) ? result.profiles : [];
      setYoutubeProfiles(profiles);

      const currentSelected = selectedYoutubeProfileIdRef.current;
      const nextSelected =
        (preferredProfileId && profiles.some(p => p.id === preferredProfileId) && preferredProfileId) ||
        (currentSelected && profiles.some(p => p.id === currentSelected) && currentSelected) ||
        (profiles[0] ? profiles[0].id : '');

      setSelectedYoutubeProfileId(nextSelected);
      if (nextSelected) {
        await checkYoutubeAuth(nextSelected);
      } else {
        setYoutubeAuthenticated(false);
      }
    } catch (error) {
      setYoutubeProfiles([]);
      setSelectedYoutubeProfileId('');
      setYoutubeAuthenticated(false);
    }
  };

  const checkYoutubeAuth = async (profileId) => {
    try {
      if (!profileId) {
        setYoutubeAuthenticated(false);
        return;
      }
      const result = await window.electronAPI.youtubeCheckAuth(profileId);
      setYoutubeAuthenticated(Boolean(result && result.authenticated));
    } catch (error) {
      setYoutubeAuthenticated(false);
    }
  };

  const handleYoutubeSelectProfile = async (profileId) => {
    setSelectedYoutubeProfileId(profileId);
    setShowAuthCodeInput(false);
    setYoutubeAuthCode('');
    setShowCredentialsForm(false);
    setYoutubeAuthenticated(false);

    const p = youtubeProfiles.find(x => x.id === profileId) || null;
    setYoutubeProfileLabel(p && p.label ? p.label : '');

    await checkYoutubeAuth(profileId);
  };

  const handleSelectYoutubeVideo = async () => {
    const path = await window.electronAPI.selectVideo();
    if (path) {
      setYoutubeVideoPath(path);
      // Auto-fill title from filename if title is empty
      if (!youtubeTitle) {
        const filename = path.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '');
        setYoutubeTitle(filename);
      }
      setStatus('');
    }
  };

  const handleSaveYoutubeCredentials = async () => {
    if (!youtubeCredentials.clientId || !youtubeCredentials.clientSecret) {
      setStatus('❌ Please enter both Client ID and Client Secret');
      return;
    }

    try {
      // Normalize redirect URI - remove trailing slashes and ensure it's just http://localhost
      let redirectUri = (youtubeCredentials.redirectUri || 'http://localhost').trim();
      // Remove trailing slash
      redirectUri = redirectUri.replace(/\/$/, '');
      // Ensure it's just http://localhost (no port)
      if (redirectUri.includes('localhost') && redirectUri !== 'http://localhost') {
        redirectUri = 'http://localhost';
      }
      
      const credentials = {
        installed: {
          client_id: youtubeCredentials.clientId.trim(),
          client_secret: youtubeCredentials.clientSecret.trim(),
          redirect_uris: [redirectUri],
        },
      };
      const result = await window.electronAPI.youtubeSaveProfile({
        id: selectedYoutubeProfileId || undefined,
        label: youtubeProfileLabel.trim(),
        credentials,
      });
      const profileId = result && result.profileId ? result.profileId : '';
      await refreshYoutubeProfiles(profileId);
      setStatus('✅ Profile saved! Make sure the redirect URI in Google Cloud Console matches exactly: ' + redirectUri);
      setShowCredentialsForm(false);
    } catch (error) {
      setStatus(`❌ Failed to save credentials: ${error.message}`);
    }
  };

  const handleYoutubeAuthenticate = () => {
    if (!selectedYoutubeProfileId) {
      setStatus('❌ Please create/select a YouTube profile first');
      return;
    }
    setShowAuthCodeInput(false);
    setYoutubeAuthCode('');
    window.electronAPI.youtubeAuthenticate(selectedYoutubeProfileId);
  };

  const handleYoutubeAuthCodeSubmit = () => {
    let code = youtubeAuthCode.trim();
    
    // If user pasted the full URL, extract just the code
    if (code.includes('code=')) {
      const match = code.match(/code=([^&]+)/);
      if (match) {
        code = match[1];
      }
    }
    
    // Also handle if they pasted the full URL with http://localhost
    if (code.includes('http://localhost')) {
      const url = new URL(code);
      code = url.searchParams.get('code') || code;
    }
    
    if (!code) {
      setStatus('❌ Please enter the authorization code');
      return;
    }
    
    if (!selectedYoutubeProfileId) {
      setStatus('❌ Please create/select a YouTube profile first');
      return;
    }

    setStatus('⏳ Verifying authorization code...');
    window.electronAPI.youtubeSendAuthCode(selectedYoutubeProfileId, code);
    setShowAuthCodeInput(false);
    setYoutubeAuthCode('');
  };

  const handleYoutubeLogout = async () => {
    try {
      if (!selectedYoutubeProfileId) {
        setStatus('❌ Please select a YouTube profile first');
        return;
      }
      await window.electronAPI.youtubeLogoutProfile(selectedYoutubeProfileId);
      setYoutubeAuthenticated(false);
      setStatus('✅ Logged out successfully');
    } catch (error) {
      setStatus(`❌ Failed to logout: ${error.message}`);
    }
  };

  const handleYoutubeResetAuth = async () => {
    const ok = window.confirm('This will delete ALL saved YouTube profiles and tokens on this computer. Continue?');
    if (!ok) return;
    try {
      await window.electronAPI.youtubeResetAuth();
      setYoutubeAuthenticated(false);
      setShowCredentialsForm(false);
      setShowAuthCodeInput(false);
      setYoutubeAuthCode('');
      setYoutubeProfiles([]);
      setSelectedYoutubeProfileId('');
      setYoutubeProfileLabel('');
      setYoutubeCredentials({ clientId: '', clientSecret: '', redirectUri: '' });
      setStatus('✅ YouTube profiles reset. Please create a profile and authenticate again.');
    } catch (error) {
      setStatus(`❌ Failed to reset OAuth: ${error.message}`);
    }
  };

  const handleYoutubeDeleteProfile = async () => {
    if (!selectedYoutubeProfileId) {
      setStatus('❌ Please select a YouTube profile first');
      return;
    }
    const ok = window.confirm('Delete the selected YouTube profile and its token from this computer?');
    if (!ok) return;
    try {
      await window.electronAPI.youtubeDeleteProfile(selectedYoutubeProfileId);
      setYoutubeAuthenticated(false);
      await refreshYoutubeProfiles('');
      setStatus('✅ Profile deleted');
    } catch (error) {
      setStatus(`❌ Failed to delete profile: ${error.message}`);
    }
  };

  const parseDatetimeLocalToDate = (value) => {
    // value format: "YYYY-MM-DDTHH:mm" (or with seconds depending on browser)
    if (!value) return null;
    const [datePart, timePartRaw] = value.split('T');
    if (!datePart || !timePartRaw) return null;
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const timePart = timePartRaw.split('.')[0]; // drop ms if present
    const [hourStr, minuteStr, secondStr] = timePart.split(':');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr || '0');

    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      Number.isNaN(second)
    ) {
      return null;
    }

    // Construct as local time explicitly
    return new Date(year, month - 1, day, hour, minute, second, 0);
  };

  const handleYoutubeUpload = () => {
    if (!selectedYoutubeProfileId) {
      setStatus('❌ Please select a YouTube profile/channel first');
      return;
    }
    if (!youtubeVideoPath) {
      setStatus('❌ Please select a video file');
      return;
    }
    if (!youtubeTitle.trim()) {
      setStatus('❌ Please enter a video title');
      return;
    }
    if (!youtubeAuthenticated) {
      setStatus('❌ Please authenticate with YouTube first');
      return;
    }

    let publishAtIso = null;
    let effectivePrivacy = youtubePrivacy;
    if (youtubeScheduleEnabled) {
      const publishDate = parseDatetimeLocalToDate(youtubePublishAtLocal);
      if (!publishDate) {
        setStatus('❌ Please choose a valid schedule date/time');
        return;
      }
      const msUntil = publishDate.getTime() - Date.now();
      if (Number.isNaN(msUntil) || msUntil < 60 * 1000) {
        setStatus('❌ Scheduled publish time must be at least 1 minute in the future');
        return;
      }
      publishAtIso = publishDate.toISOString();

      // YouTube requires privacyStatus=private when setting publishAt
      if (effectivePrivacy !== 'private') {
        effectivePrivacy = 'private';
      }
    }

    setIsYoutubeUploading(true);
    setYoutubeUploadProgress(0);
    setYoutubeUploadMessage('Preparing upload...');
    if (youtubeScheduleEnabled) {
      setStatus('📤 Uploading now and scheduling publish on YouTube...');
    } else {
      setStatus('📤 Starting upload...');
    }

    const tags = youtubeTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const metadata = {
      title: youtubeTitle,
      description: youtubeDescription,
      tags: tags,
      privacyStatus: effectivePrivacy,
      categoryId: youtubeCategory,
    };
    if (publishAtIso) {
      metadata.publishAt = publishAtIso;
    }

    window.electronAPI.youtubeUploadVideo(selectedYoutubeProfileId, youtubeVideoPath, metadata);
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

  const handleSelectPanZoomImageFolder = async () => {
    const path = await window.electronAPI.selectImageFolder();
    if (path) {
      setPanZoomImageFolder(path);
      setStatus('');
    }
  };

  const handleSelectPanZoomOutputFolder = async () => {
    const path = await window.electronAPI.selectOutputDirectory();
    if (path) {
      setPanZoomOutputFolder(path);
      setStatus('');
    }
  };

  const handleSelectPanZoomAudio = async () => {
    const path = await window.electronAPI.selectAudio();
    if (path) {
      setPanZoomBackgroundMusic(prev => ({ ...prev, path, enabled: true }));
      setStatus('');
    }
  };

  const handleGeneratePanZoomVideo = () => {
    if (!panZoomImageFolder) {
      setStatus('❌ Please select an image folder');
      return;
    }

    if (!panZoomOutputFolder) {
      setStatus('❌ Please select an output folder');
      return;
    }

    setIsPanZoomGenerating(true);
    setPanZoomProgress(0);
    setPanZoomProgressMessage('Initializing...');
    setStatus('🎬 Generating pan/zoom videos...');

    const options = {
      imageFolder: panZoomImageFolder,
      outputFolder: panZoomOutputFolder,
      videoWidth: parseInt(panZoomVideoWidth),
      videoHeight: parseInt(panZoomVideoHeight),
      fps: parseInt(panZoomFps),
      imageDuration: parseFloat(panZoomImageDuration),
      batchSize: parseInt(panZoomBatchSize),
      maxVideos: parseInt(panZoomMaxVideos) || 0, // 0 means create all possible videos
      shakeMagnitude: parseFloat(panZoomShakeMagnitude),
      zoomMagnitude: parseFloat(panZoomZoomMagnitude),
      panMagnitude: parseFloat(panZoomPanMagnitude),
      backgroundMusic: panZoomBackgroundMusic.enabled && panZoomBackgroundMusic.path ? panZoomBackgroundMusic : null,
    };

    window.electronAPI.generatePanZoomVideo(options);
  };

  const handleCancelPanZoomVideo = () => {
    window.electronAPI.cancelPanZoomVideo();
    setIsPanZoomGenerating(false);
    setPanZoomProgress(0);
    setPanZoomProgressMessage('');
    setStatus('⚠️ Video generation cancelled');
  };

  const handlePanZoomSocialPreset = (preset) => {
    setPanZoomSocialPreset(preset);
    const presets = {
      instagram: { width: 1080, height: 1080 },
      'instagram-story': { width: 1080, height: 1920 },
      'instagram-reel': { width: 1080, height: 1920 },
      tiktok: { width: 1080, height: 1920 },
      'youtube-shorts': { width: 1080, height: 1920 },
      youtube: { width: 1920, height: 1080 },
      facebook: { width: 1280, height: 720 },
      twitter: { width: 1280, height: 720 },
      custom: { width: 720, height: 1280 },
    };
    if (presets[preset]) {
      setPanZoomVideoWidth(presets[preset].width);
      setPanZoomVideoHeight(presets[preset].height);
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

  const handleCancel = () => {
    window.electronAPI.cancelScrollingVideo();
    setIsGenerating(false);
    setProgress(0);
    setProgressMessage('');
    setStatus('⚠️ Video generation cancelled');
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

  const selectedYoutubeProfile = youtubeProfiles.find(p => p.id === selectedYoutubeProfileId) || null;

  return (
    <div className="scrolling-video-container">
      {/* Top-level Tab Navigation */}
      <div className="main-tab-navigation">
        <button
          className={`main-tab-button ${activeMainTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('advanced')}
          disabled={isGenerating}
        >
          📜 Advanced Video Generator
        </button>
        <button
          className={`main-tab-button ${activeMainTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('video')}
          disabled={isGenerating}
        >
          🎬 Video Generator
        </button>
        <button
          className={`main-tab-button ${activeMainTab === 'uploader' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('uploader')}
          disabled={isGenerating}
        >
          📤 Video Uploader
        </button>
      </div>

      {/* Advanced Video Generator Tab */}
      {activeMainTab === 'advanced' && (
        <>
      <div className="form-section">
        {/* Tab Navigation */}
        <div className="tab-navigation">
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
            🎬 Video Quality & Export
          </button>
        </div>

        {/* Basic Settings */}
        {activeSettingsTab === 'basic' && (
          <div className="section-content">
            {/* Action Buttons Row */}
            <div className="form-group">
              <div className="button-group-full">
                <button onClick={handleSaveProject} disabled={isGenerating} className="small-btn">
                  💾 Save Project
                </button>
                <button onClick={handleLoadProject} disabled={isGenerating} className="small-btn">
                  📂 Load Project
                </button>
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
            </div>

            {/* Text Outline Settings */}
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

            {/* Drop Shadow Settings */}
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
        )}

        {/* Background Settings */}
        {activeSettingsTab === 'background' && (
          <div className="section-content">
            {/* Image Filter, Rotation, and Gradient in One Row */}
            <div className="form-row-three">
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
                    onChange={(e) => setBackgroundGradient(prev => ({
                      ...prev,
                      enabled: e.target.checked
                    }))}
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
                  step="0.1"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  disabled={isGenerating}
                />
                <span>{Math.round(overlayOpacity * 100)}%</span>
              </div>
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
            </div>

            {/* Contrast and Saturation in Next Row */}
            <div className="form-row">
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

            {/* Voice Language and Background Music in One Row */}
            <div className="form-row audio-controls-row">
              <div className="form-group">
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
              </div>
              <div className="form-group">
                <label>Background Music</label>
                <button onClick={handleSelectAudio} disabled={isGenerating} className="audio-control-btn">
                  🎵 Select Audio File
                </button>
                {backgroundMusic.path && (
                  <p className="file-info">Selected: {backgroundMusic.path.split(/[/\\]/).pop()}</p>
                )}
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
        )}

        {/* Video Quality & Export */}
        {activeSettingsTab === 'quality' && (
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
            </div>

            <div className="form-group">
              <label>Additional Exports</label>
              <div className="form-row-three exports-checkboxes">
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
            <div className="cancel-button-container">
              <button onClick={handleCancel} className="cancel-button">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {status && <p className="status-message">{status}</p>}
      </div>
        </>
      )}

      {/* Video Generator Tab */}
      {activeMainTab === 'video' && (
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
              <button onClick={handleSelectPanZoomAudio} disabled={isPanZoomGenerating} className="audio-control-btn">
                🎵 Select Audio File
              </button>
              {panZoomBackgroundMusic.path && (
                <p className="file-info">Selected: {panZoomBackgroundMusic.path.split(/[/\\]/).pop()}</p>
              )}
            </div>

            {panZoomBackgroundMusic.enabled && panZoomBackgroundMusic.path && (
              <div className="form-row">
                <div className="form-group">
                  <label>Volume (0-1)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={panZoomBackgroundMusic.volume}
                    onChange={(e) => setPanZoomBackgroundMusic(prev => ({
                      ...prev,
                      volume: parseFloat(e.target.value)
                    }))}
                    disabled={isPanZoomGenerating}
                  />
                  <span>{Math.round(panZoomBackgroundMusic.volume * 100)}%</span>
                </div>
                <div className="form-group">
                  <label>Fade In (seconds)</label>
                  <input
                    type="number"
                    value={panZoomBackgroundMusic.fadeIn}
                    onChange={(e) => setPanZoomBackgroundMusic(prev => ({
                      ...prev,
                      fadeIn: parseFloat(e.target.value)
                    }))}
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
                    onChange={(e) => setPanZoomBackgroundMusic(prev => ({
                      ...prev,
                      fadeOut: parseFloat(e.target.value)
                    }))}
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
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${panZoomProgress}%` }}
                  >
                    <span className="progress-text">{panZoomProgress}%</span>
                  </div>
                </div>
                {panZoomProgressMessage && (
                  <p className="progress-message">{panZoomProgressMessage}</p>
                )}
                <div className="cancel-button-container">
                  <button onClick={handleCancelPanZoomVideo} className="cancel-button">
                    ❌ Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Status Message */}
            {status && <p className="status-message">{status}</p>}
          </div>
        </div>
      )}

      {/* Video Uploader Tab */}
      {activeMainTab === 'uploader' && (
        <div className="form-section">
          <div className="section-content">
            <h2>📤 YouTube Video Uploader</h2>

            {/* Authentication Section */}
            <div className="form-group" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🔐 Authentication</h3>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Channel Profile</label>
                <div className="input-with-button">
                  <select
                    value={selectedYoutubeProfileId}
                    onChange={(e) => handleYoutubeSelectProfile(e.target.value)}
                    disabled={isYoutubeUploading}
                    style={{ flex: 1, padding: '8px' }}
                  >
                    <option value="">-- Select or create a profile --</option>
                    {youtubeProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.channel && p.channel.title) ? p.channel.title : (p.label || p.id)}
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
                    disabled={isYoutubeUploading}
                    style={{ marginLeft: '10px' }}
                  >
                    ➕ New
                  </button>
                  <button
                    onClick={handleYoutubeDeleteProfile}
                    className="small-btn"
                    disabled={isYoutubeUploading || !selectedYoutubeProfileId}
                    style={{ marginLeft: '10px', backgroundColor: '#dc3545' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
                <small style={{ color: '#666', fontSize: '11px' }}>
                  Each profile stores its own token, so you can upload to multiple YouTube channels by switching profiles.
                </small>
              </div>

              {selectedYoutubeProfileId ? (
                <p style={{ color: youtubeAuthenticated ? 'green' : '#666', marginBottom: '10px' }}>
                  {youtubeAuthenticated
                    ? `✅ Authenticated${selectedYoutubeProfile?.channel?.title ? ` as ${selectedYoutubeProfile.channel.title}` : ''}`
                    : 'Not authenticated'}
                </p>
              ) : (
                <p style={{ color: '#666', marginBottom: '10px' }}>Select or create a profile to authenticate.</p>
              )}

              <div style={{ marginBottom: '15px' }}>
                <button
                  onClick={() => setShowCredentialsForm(!showCredentialsForm)}
                  className="small-btn"
                  style={{ marginRight: '10px' }}
                  disabled={isYoutubeUploading}
                >
                  {showCredentialsForm ? '❌ Cancel' : (selectedYoutubeProfileId ? '⚙️ Edit Profile Credentials' : '⚙️ Setup Profile')}
                </button>
                <button
                  onClick={handleYoutubeResetAuth}
                  className="small-btn"
                  style={{ marginRight: '10px', backgroundColor: '#6c757d' }}
                  disabled={isYoutubeUploading}
                >
                  🧹 Reset All Profiles
                </button>
                {youtubeAuthenticated && (
                  <button onClick={handleYoutubeLogout} className="small-btn" style={{ marginRight: '10px', backgroundColor: '#dc3545' }}>
                    🚪 Logout
                  </button>
                )}
                {!youtubeAuthenticated && !showCredentialsForm && !showAuthCodeInput && selectedYoutubeProfileId && (
                  <button onClick={handleYoutubeAuthenticate} className="small-btn" style={{ backgroundColor: '#28a745' }}>
                    🔑 Authenticate
                  </button>
                )}
              </div>

              {showAuthCodeInput && (
                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '5px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
                        <strong>📋 Instructions:</strong>
                        <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
                          <li>After authorizing, you'll be redirected to a page that says "This site can't be reached" - this is normal!</li>
                          <li>Look at the URL in your browser's address bar</li>
                          <li>Copy the <strong>entire URL</strong> (or just the code part after "code=")</li>
                          <li>Paste it in the field below - the app will automatically extract the code</li>
                        </ol>
                        <p style={{ margin: '5px 0', fontStyle: 'italic' }}>
                          Example URL: <code style={{ fontSize: '10px', backgroundColor: '#f0f0f0', padding: '2px 4px' }}>http://localhost/?code=4/0ATX87lMXer-07T4IBVLMaM6HWntf9JzYlyhRQDUHy0NYUhyRTV04Ooy-B-mA34leI2Tg7g</code>
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
                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '5px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '1px solid #ffc107' }}>
                        <strong>📋 Setup Instructions:</strong>
                        <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
                          <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                          <li>Create a new project or select an existing one</li>
                          <li>Enable YouTube Data API v3</li>
                          <li><strong>Configure OAuth Consent Screen:</strong>
                            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                              <li>Go to "OAuth consent screen" in the left menu</li>
                              <li>Choose "External" (unless you have a Google Workspace)</li>
                              <li>Fill in App name, User support email, Developer contact</li>
                              <li>Add your email to "Test users" if app is in Testing mode</li>
                              <li>Save and continue through all steps</li>
                            </ul>
                          </li>
                          <li>Create OAuth 2.0 Client ID credentials</li>
                          <li><strong>Important:</strong> Choose "Desktop app" or "Installed application" as the application type</li>
                          <li>Add <code>http://localhost</code> (exactly, no trailing slash) as an authorized redirect URI</li>
                          <li>Copy the Client ID and Client Secret below</li>
                        </ol>
                        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#f8d7da', borderRadius: '3px', border: '1px solid #f5c6cb' }}>
                          <strong>⚠️ If you get "403: access_denied":</strong>
                          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                            <li>Make sure OAuth consent screen is configured</li>
                            <li>If app is in "Testing" mode, add your Google account email to "Test users"</li>
                            <li>Verify redirect URI matches exactly: <code>http://localhost</code></li>
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
                          onChange={(e) => setYoutubeCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                          placeholder="Enter Client ID (ends with .apps.googleusercontent.com)"
                          style={{ width: '100%', padding: '8px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Client Secret *</label>
                        <input
                          type="password"
                          value={youtubeCredentials.clientSecret}
                          onChange={(e) => setYoutubeCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                          placeholder="Enter Client Secret"
                          style={{ width: '100%', padding: '8px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Redirect URI</label>
                        <input
                          type="text"
                          value={youtubeCredentials.redirectUri}
                          onChange={(e) => setYoutubeCredentials(prev => ({ ...prev, redirectUri: e.target.value }))}
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

            {/* Video Selection */}
            <div className="form-group">
              <label>Video File</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={youtubeVideoPath ? youtubeVideoPath.split(/[/\\]/).pop() : 'No video selected'}
                  placeholder="Select a video file to upload"
                  readOnly
                  style={{ flex: 1 }}
                />
                <button onClick={handleSelectYoutubeVideo} disabled={isYoutubeUploading} className="small-btn">
                  📁 Select Video
                </button>
              </div>
            </div>

            {/* Video Metadata */}
            <div className="form-group">
              <label>Video Title *</label>
              <input
                type="text"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                placeholder="Enter video title"
                disabled={isYoutubeUploading}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={youtubeDescription}
                onChange={(e) => setYoutubeDescription(e.target.value)}
                placeholder="Enter video description"
                rows={4}
                disabled={isYoutubeUploading}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={youtubeTags}
                  onChange={(e) => setYoutubeTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  disabled={isYoutubeUploading}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Privacy Status</label>
                <select
                  value={youtubePrivacy}
                  onChange={(e) => setYoutubePrivacy(e.target.value)}
                  disabled={isYoutubeUploading}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            {/* Scheduling */}
            <div className="form-group" style={{ marginTop: '10px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: youtubeScheduleEnabled ? '10px' : 0 }}>
                <input
                  id="youtubeScheduleEnabled"
                  type="checkbox"
                  checked={youtubeScheduleEnabled}
                  onChange={(e) => setYoutubeScheduleEnabled(e.target.checked)}
                  disabled={isYoutubeUploading}
                />
                <label htmlFor="youtubeScheduleEnabled" style={{ margin: 0 }}>
                  Schedule publish (upload now, publish later)
                </label>
              </div>

              {youtubeScheduleEnabled && (
                <>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label>Publish Date & Time (your local time)</label>
                    <input
                      type="datetime-local"
                      value={youtubePublishAtLocal}
                      onChange={(e) => setYoutubePublishAtLocal(e.target.value)}
                      disabled={isYoutubeUploading}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>
                  <small style={{ color: '#666', fontSize: '11px' }}>
                    Scheduling requires the video to be <strong>Private</strong>. If you selected Public/Unlisted, the app will still upload as Private and schedule publishing.
                  </small>
                </>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleYoutubeUpload}
              disabled={
                isYoutubeUploading ||
                !selectedYoutubeProfileId ||
                !youtubeAuthenticated ||
                !youtubeVideoPath ||
                !youtubeTitle.trim() ||
                (youtubeScheduleEnabled && !youtubePublishAtLocal)
              }
              className="generate-button"
              style={{ marginTop: '20px' }}
            >
              {isYoutubeUploading ? '⏳ Uploading...' : '📤 Upload to YouTube'}
            </button>

            {/* Upload Progress */}
            {isYoutubeUploading && (
              <div className="progress-section" style={{ marginTop: '20px' }}>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${youtubeUploadProgress}%` }}
                  >
                    <span className="progress-text">{youtubeUploadProgress}%</span>
                  </div>
                </div>
                {youtubeUploadMessage && (
                  <p className="progress-message">{youtubeUploadMessage}</p>
                )}
              </div>
            )}

            {/* Status Message */}
            {status && <p className="status-message">{status}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScrollingTextVideo;
