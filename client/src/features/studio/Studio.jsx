import React, { useState, useEffect, useRef } from 'react';
import '../../ScrollingTextVideo.css';
import { StudioContext } from './StudioContext';
import AdvancedTab from './tabs/AdvancedTab';
import PanZoomTab from './tabs/PanZoomTab';
import EffectsTab from './tabs/EffectsTab';
import UploaderTab from './tabs/UploaderTab';

function ScrollingTextVideo() {
  const YT_SELECTED_PROFILE_KEY = 'slideshow-generator.youtube.selectedProfileId';
  const YT_DEFAULT_PRIVACY = 'private';
  const YT_DEFAULT_CATEGORY_ID = '22';

  // Basic state
  const [imagePath, setImagePath] = useState('');
  const [imagePaths, setImagePaths] = useState([]);
  const [videoPath, setVideoPath] = useState('');
  const [text, setText] = useState('');
  const [texts, setTexts] = useState([{ text: '', x: null, y: null }]);
  const [audioText, setAudioText] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('en');
  const [audioProvider, setAudioProvider] = useState('xtts'); // google | system | xtts (default: xtts)
  const [ttsVoices, setTtsVoices] = useState([]); // [{name,culture,gender,age}]
  const [selectedTtsVoiceName, setSelectedTtsVoiceName] = useState('');
  const [xttsVoices, setXttsVoices] = useState([]); // [{id,label,filename}]
  const [xttsVoicesError, setXttsVoicesError] = useState('');
  const [xttsVoicesLoading, setXttsVoicesLoading] = useState(false); // Loading state for XTTS voices
  const [selectedXttsVoiceId, setSelectedXttsVoiceId] = useState('');
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
  // Separate progress for audio and video
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioProgressMessage, setAudioProgressMessage] = useState('');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressMessage, setVideoProgressMessage] = useState('');
  // Timing (Advanced generator): elapsed + ETA based on observed progress rate
  const [scrollingElapsedSec, setScrollingElapsedSec] = useState(0);
  const [scrollingEtaSec, setScrollingEtaSec] = useState(null); // null = unknown / not enough info yet
  const scrollingTimingRef = useRef({
    startMs: 0,
    lastMs: 0,
    lastProgress: 0,
    emaSecPerPct: null, // exponential moving average (seconds per 1%)
  });
  // Scoped status messages so notifications only appear in the relevant section
  const [scrollingStatus, setScrollingStatus] = useState('');
  const [panZoomStatus, setPanZoomStatus] = useState('');
  const [effectStatus, setEffectStatus] = useState('');
  const [youtubeStatus, setYoutubeStatus] = useState('');
  const [activeMainTab, setActiveMainTab] = useState('advanced');
  const [activeSettingsTab, setActiveSettingsTab] = useState('basic');

  const resetScrollingTiming = () => {
    const now = Date.now();
    scrollingTimingRef.current = {
      startMs: now,
      lastMs: now,
      lastProgress: 0,
      emaSecPerPct: null,
    };
    setScrollingElapsedSec(0);
    setScrollingEtaSec(null);
  };

  // Keep "elapsed time" ticking while generating
  useEffect(() => {
    if (!isGenerating) return;
    if (!scrollingTimingRef.current.startMs) {
      resetScrollingTiming();
    }
    const id = setInterval(() => {
      const startMs = scrollingTimingRef.current.startMs || Date.now();
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setScrollingElapsedSec(elapsed);
    }, 500);
    return () => clearInterval(id);
  }, [isGenerating]);

  // YouTube Upload state
  const [youtubeProfiles, setYoutubeProfiles] = useState([]);
  const [selectedYoutubeProfileId, setSelectedYoutubeProfileId] = useState('');
  const [youtubeAuthenticated, setYoutubeAuthenticated] = useState(false);
  const [youtubeProfileLabel, setYoutubeProfileLabel] = useState('');
  const [youtubeCredentials, setYoutubeCredentials] = useState({ clientId: '', clientSecret: '', redirectUri: '' });
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [youtubeAuthCode, setYoutubeAuthCode] = useState('');
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);
  const [youtubeBatchItems, setYoutubeBatchItems] = useState([]); // {id, path, title, description, tags, privacyStatus, categoryId, status, progress, message, result, error}
  const [editingBatchItemId, setEditingBatchItemId] = useState('');
  const [editingBatchForm, setEditingBatchForm] = useState({
    title: '',
    description: '',
    tags: '',
    privacyStatus: YT_DEFAULT_PRIVACY,
    scheduleEnabled: false,
    publishAtLocal: '',
  });

  // Avoid stale state inside long-lived IPC listeners
  const selectedYoutubeProfileIdRef = useRef('');
  useEffect(() => {
    selectedYoutubeProfileIdRef.current = selectedYoutubeProfileId;
    try {
      if (selectedYoutubeProfileId) {
        localStorage.setItem(YT_SELECTED_PROFILE_KEY, selectedYoutubeProfileId);
      } else {
        localStorage.removeItem(YT_SELECTED_PROFILE_KEY);
      }
    } catch (_) {
      // ignore storage failures
    }
  }, [selectedYoutubeProfileId]);

  // Load system voices (Windows). Safe no-op on other OS / when unavailable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.electronAPI || !window.electronAPI.listTtsVoices) return;
        const voices = await window.electronAPI.listTtsVoices();
        if (cancelled) return;
        const list = Array.isArray(voices) ? voices : [];
        setTtsVoices(list);
        // Pick a default voice if none selected
        if (!selectedTtsVoiceName && list.length > 0) {
          setSelectedTtsVoiceName(list[0].name);
        }
      } catch (_) {
        if (!cancelled) {
          setTtsVoices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load XTTS voices when provider is selected (may start XTTS sidecar)
  useEffect(() => {
    let cancelled = false;
    if (audioProvider !== 'xtts') {
      setXttsVoicesLoading(false);
      return () => {};
    }
    (async () => {
      try {
        setXttsVoicesError('');
        setXttsVoicesLoading(true); // Set loading state
        if (!window.electronAPI || !window.electronAPI.xttsListVoices) {
          setXttsVoices([]);
          setXttsVoicesError('XTTS API is not available (preload not loaded).');
          setXttsVoicesLoading(false);
          return;
        }
        console.log('[XTTS] Fetching voices...');
        const result = await window.electronAPI.xttsListVoices();
        console.log('[XTTS] Result:', result);
        if (cancelled) return;
        const list = result && Array.isArray(result.voices) ? result.voices : [];
        console.log('[XTTS] Voices list:', list);
        setXttsVoices(list);
        if (!selectedXttsVoiceId && list.length > 0) {
          setSelectedXttsVoiceId(list[0].id);
        }
        if (result && result.error) {
          console.error('[XTTS] Error from server:', result.error);
          setXttsVoicesError(String(result.error || ''));
        }
        setXttsVoicesLoading(false); // Clear loading state
      } catch (err) {
        console.error('[XTTS] Exception:', err);
        if (!cancelled) {
          setXttsVoices([]);
          setXttsVoicesError(err?.message ? String(err.message) : String(err));
        }
        setXttsVoicesLoading(false); // Clear loading state on error
      }
    })();
    return () => {
      cancelled = true;
      setXttsVoicesLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioProvider]);

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

  // Effect Generator state (separate from Pan/Zoom generator)
  const [effectImageFolder, setEffectImageFolder] = useState('');
  const [effectOutputFolder, setEffectOutputFolder] = useState('');
  const [effectSocialPreset, setEffectSocialPreset] = useState('custom');
  const [effectVideoWidth, setEffectVideoWidth] = useState(720);
  const [effectVideoHeight, setEffectVideoHeight] = useState(1280);
  const [effectFps, setEffectFps] = useState(24);
  const [effectImageDuration, setEffectImageDuration] = useState(3.2);
  const [effectBatchSize, setEffectBatchSize] = useState(5);
  const [effectBackgroundMusic, setEffectBackgroundMusic] = useState({ enabled: false, path: '', volume: 0.5, fadeIn: 0, fadeOut: 0 });
  const [effectPreset, setEffectPreset] = useState('smooth');
  const [effectTransitionType, setEffectTransitionType] = useState('crossfade');
  const [effectTransitionDuration, setEffectTransitionDuration] = useState(0.6);
  const [isEffectGenerating, setIsEffectGenerating] = useState(false);
  const [effectProgress, setEffectProgress] = useState(0);
  const [effectProgressMessage, setEffectProgressMessage] = useState('');

  useEffect(() => {
    window.electronAPI.onScrollingVideoProgress((progressData) => {
      const canUpdateProgress =
        typeof progressData.progress === 'number' && !Number.isNaN(progressData.progress);

      if (progressData.type === 'frame' || progressData.type === 'batch') {
        if (canUpdateProgress) {
          setVideoProgress(progressData.progress);
          // Also update main progress for backward compatibility
          setProgress(progressData.progress);
        }
        setVideoProgressMessage(progressData.message || `Processing: ${progressData.current}/${progressData.total}`);
        setProgressMessage(progressData.message || `Processing: ${progressData.current}/${progressData.total}`);
      } else if (progressData.type === 'encoding') {
        if (canUpdateProgress) {
          setVideoProgress(progressData.progress);
          setProgress(progressData.progress);
        }
        setVideoProgressMessage(progressData.message || 'Encoding video...');
        setProgressMessage(progressData.message || 'Encoding video...');
      } else if (progressData.type === 'audio') {
        if (canUpdateProgress) {
          setAudioProgress(progressData.progress || 0);
          // Don't update main progress for audio (video has its own bar)
        }
        setAudioProgressMessage(progressData.message || 'Generating narration audio...');
      } else if (progressData.type === 'audio-mix') {
        if (canUpdateProgress) {
          // Audio mixing is part of video finalization
          setVideoProgress(progressData.progress);
          setProgress(progressData.progress);
        }
        setVideoProgressMessage(progressData.message || 'Mixing audio with video...');
        setProgressMessage(progressData.message || 'Mixing audio with video...');
      } else if (progressData.message) {
        if (canUpdateProgress) {
          setProgress(progressData.progress);
          // Try to determine if it's audio or video based on message
          const msg = progressData.message.toLowerCase();
          if (msg.includes('audio') || msg.includes('narration') || msg.includes('tts')) {
            setAudioProgress(progressData.progress);
          } else {
            setVideoProgress(progressData.progress);
          }
        }
        setProgressMessage(progressData.message);
      }

      // Update ETA estimate when progress moves forward
      if (canUpdateProgress) {
        const p = Math.max(0, Math.min(100, progressData.progress));
        const now = Date.now();
        const t = scrollingTimingRef.current;
        if (!t.startMs) {
          t.startMs = now;
          t.lastMs = now;
          t.lastProgress = p;
          t.emaSecPerPct = null;
          setScrollingElapsedSec(0);
          setScrollingEtaSec(null);
        }

        const dp = p - (t.lastProgress || 0);
        const dt = (now - (t.lastMs || now)) / 1000;
        // Only update on forward motion and with a minimum time delta to reduce noise.
        if (dp > 0.1 && dt >= 0.2) {
          const secPerPct = dt / dp;
          const alpha = 0.25; // smoothing factor (higher = more responsive, lower = more stable)
          const ema = t.emaSecPerPct == null ? secPerPct : (t.emaSecPerPct * (1 - alpha) + secPerPct * alpha);
          t.emaSecPerPct = ema;
          const remaining = (100 - p) * ema;
          setScrollingEtaSec(Number.isFinite(remaining) && remaining > 0 ? Math.round(remaining) : null);
        }

        t.lastMs = now;
        t.lastProgress = p;

        // If we're essentially done, don't show ETA
        if (p >= 100) {
          setScrollingEtaSec(0);
        }
      }
    });

    window.electronAPI.onScrollingVideoDone((path) => {
      setIsGenerating(false);
      setProgress(100);
      setProgressMessage('');
      setAudioProgress(100);
      setAudioProgressMessage('');
      setVideoProgress(100);
      setVideoProgressMessage('');
      setScrollingEtaSec(0);
      setScrollingStatus(`✅ Video created successfully: ${path}`);
    });

    window.electronAPI.onScrollingVideoError((error) => {
      setIsGenerating(false);
      setProgress(0);
      setProgressMessage('');
      setAudioProgress(0);
      setAudioProgressMessage('');
      setVideoProgress(0);
      setVideoProgressMessage('');
      setScrollingEtaSec(null);
      setScrollingStatus(`❌ Error: ${error}`);
    });

    window.electronAPI.onScrollingVideoCancelled(() => {
      setIsGenerating(false);
      setProgress(0);
      setProgressMessage('');
      setAudioProgress(0);
      setAudioProgressMessage('');
      setVideoProgress(0);
      setVideoProgressMessage('');
      setScrollingEtaSec(null);
      setScrollingStatus('⚠️ Video generation cancelled');
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
      setPanZoomStatus(`✅ Pan/Zoom videos created successfully! Total: ${result.totalVideos} videos in ${result.outputFolder}`);
    });

    window.electronAPI.onPanZoomVideoError((error) => {
      setIsPanZoomGenerating(false);
      setPanZoomProgress(0);
      setPanZoomProgressMessage('');
      setPanZoomStatus(`❌ Error: ${error}`);
    });

    window.electronAPI.onPanZoomVideoCancelled(() => {
      setIsPanZoomGenerating(false);
      setPanZoomProgress(0);
      setPanZoomProgressMessage('');
      setPanZoomStatus('⚠️ Video generation cancelled');
    });

    // Effect Generator event listeners
    if (window.electronAPI.onEffectVideoProgress) {
      window.electronAPI.onEffectVideoProgress((progressData) => {
        const canUpdateProgress =
          progressData && typeof progressData.progress === 'number' && !Number.isNaN(progressData.progress);

        if (canUpdateProgress) {
          setEffectProgress(progressData.progress);
        }
        setEffectProgressMessage(progressData.message || 'Processing...');
      });

      window.electronAPI.onEffectVideoDone((result) => {
        setIsEffectGenerating(false);
        setEffectProgress(100);
        setEffectProgressMessage('');
        if (result && typeof result.totalVideos === 'number' && result.outputFolder) {
          setEffectStatus(`✅ Effect videos created successfully! Total: ${result.totalVideos} videos in ${result.outputFolder}`);
        } else {
          setEffectStatus('✅ Effect videos created successfully!');
        }
      });

      window.electronAPI.onEffectVideoError((error) => {
        setIsEffectGenerating(false);
        setEffectProgress(0);
        setEffectProgressMessage('');
        setEffectStatus(`❌ Error: ${error}`);
      });

      window.electronAPI.onEffectVideoCancelled(() => {
        setIsEffectGenerating(false);
        setEffectProgress(0);
        setEffectProgressMessage('');
        setEffectStatus('⚠️ Effect video generation cancelled');
      });
    }

    return () => {
      window.electronAPI.removeScrollingVideoListeners();
      window.electronAPI.removeYoutubeListeners();
      window.electronAPI.removePanZoomVideoListeners();
      window.electronAPI.removeEffectVideoListeners && window.electronAPI.removeEffectVideoListeners();
    };
  }, []);

  // YouTube Upload useEffect
  useEffect(() => {
    // Load profiles and auth status on mount
    let preferred = '';
    try {
      preferred = localStorage.getItem(YT_SELECTED_PROFILE_KEY) || '';
    } catch (_) {
      preferred = '';
    }
    refreshYoutubeProfiles(preferred);

    // Set up YouTube event listeners
    window.electronAPI.onYoutubeAuthUrl((payload) => {
      const url = payload && payload.url ? payload.url : payload;
      const profileId = payload && payload.profileId ? payload.profileId : '';
      if (profileId) {
        setSelectedYoutubeProfileId(profileId);
      }
      window.electronAPI.youtubeOpenUrl(url);
      setShowAuthCodeInput(true);
      setYoutubeStatus('🔐 Please authorize the app in your browser. After authorization, copy the code from the URL and paste it below.');
    });

    window.electronAPI.onYoutubeAuthSuccess(async (payload) => {
      const profileId = payload && payload.profileId ? payload.profileId : '';
      if (profileId) {
        setSelectedYoutubeProfileId(profileId);
      }
      setYoutubeAuthenticated(true);
      setYoutubeStatus('✅ Successfully authenticated with YouTube!');
      await refreshYoutubeProfiles(profileId);
    });

    window.electronAPI.onYoutubeProfileUpdated(async (payload) => {
      const profileId = payload && payload.profileId ? payload.profileId : '';
      await refreshYoutubeProfiles(profileId);
    });

    window.electronAPI.onYoutubeUploadProgress((progressData) => {
      // Batch upload UI only (single uploader removed)
      if (progressData && progressData.uploadId) {
        const id = progressData.uploadId;
        setYoutubeBatchItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'uploading',
                  progress: typeof progressData.progress === 'number' ? progressData.progress : item.progress,
                  message: progressData.message || item.message,
                }
              : item
          )
        );
      }
    });

    window.electronAPI.onYoutubeUploadSuccess((result) => {
      // Batch success only (single uploader removed)
      if (result && result.uploadId) {
        const id = result.uploadId;
        setYoutubeBatchItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: 'done', progress: 100, message: '', result, error: '' }
              : item
          )
        );
        setYoutubeStatus(`✅ Uploaded: ${result.url || 'Success'}`);
        return;
      }
    });

    window.electronAPI.onYoutubeUploadError((error) => {
      // Batch error
      if (error && typeof error === 'object' && error.uploadId) {
        const id = error.uploadId;
        const errStr = String(error.error || error.message || 'Upload failed');
        setYoutubeBatchItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'error', error: errStr, message: '' } : item))
        );
        setYoutubeStatus(`❌ Upload failed: ${errStr}`);
        return;
      }
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

      setYoutubeStatus(errorMessage);
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
      
      setYoutubeStatus(errorMessage);
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

  const handleSelectYoutubeVideosBatch = async () => {
    const paths = await window.electronAPI.selectVideos();
    if (!paths || paths.length === 0) return;

    const newItems = paths.map((p) => {
      const filename = p.split(/[/\\]/).pop();
      const title = filename ? filename.replace(/\.[^/.]+$/, '') : 'Untitled Video';
      return {
        id: `batch-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        path: p,
        title,
        description: '',
        tags: '',
        privacyStatus: YT_DEFAULT_PRIVACY,
        categoryId: YT_DEFAULT_CATEGORY_ID,
        scheduleEnabled: false,
        publishAtLocal: '',
        status: 'pending',
        progress: 0,
        message: '',
        result: null,
        error: '',
      };
    });

    setYoutubeBatchItems((prev) => {
      const existingPaths = new Set(prev.map((x) => x.path));
      const merged = [...prev];
      for (const item of newItems) {
        if (!existingPaths.has(item.path)) merged.push(item);
      }
      return merged;
    });
    setYoutubeStatus(`✅ Added ${newItems.length} video(s) to batch queue`);
  };

  const startBatchUploadItem = (itemId) => {
    if (!selectedYoutubeProfileId) {
      setYoutubeStatus('❌ Please select a YouTube profile/channel first');
      return;
    }
    if (!youtubeAuthenticated) {
      setYoutubeStatus('❌ Please authenticate with YouTube first');
      return;
    }

    const item = youtubeBatchItems.find((x) => x.id === itemId);
    if (!item) return;

    const tagsSource = typeof item.tags === 'string' ? item.tags : '';
    const tags = String(tagsSource || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const metadata = {
      title: item.title || 'Untitled Video',
      description: typeof item.description === 'string' ? item.description : '',
      tags,
      privacyStatus: item.privacyStatus || YT_DEFAULT_PRIVACY,
      categoryId: item.categoryId || YT_DEFAULT_CATEGORY_ID,
    };

    // Optional per-item scheduling (same rules as single upload)
    if (item.scheduleEnabled) {
      const publishDate = parseDatetimeLocalToDate(item.publishAtLocal);
      if (!publishDate) {
        setYoutubeStatus('❌ Please choose a valid schedule date/time for the selected batch video');
        return;
      }
      const msUntil = publishDate.getTime() - Date.now();
      if (Number.isNaN(msUntil) || msUntil < 60 * 1000) {
        setYoutubeStatus('❌ Scheduled publish time must be at least 1 minute in the future');
        return;
      }
      metadata.publishAt = publishDate.toISOString();

      // YouTube requires privacyStatus=private when setting publishAt
      if (metadata.privacyStatus !== 'private') {
        metadata.privacyStatus = 'private';
      }
    }

    setYoutubeBatchItems((prev) =>
      prev.map((x) => (x.id === itemId ? { ...x, status: 'uploading', progress: 0, message: 'Starting...' } : x))
    );

    window.electronAPI.youtubeUploadVideo(selectedYoutubeProfileId, item.path, metadata, itemId);
  };

  const handleBatchUploadAllParallel = () => {
    const pending = youtubeBatchItems.filter((x) => x.status === 'pending' || x.status === 'error');
    if (pending.length === 0) {
      setYoutubeStatus('ℹ️ No pending videos in the batch queue');
      return;
    }
    setYoutubeStatus(`📤 Starting ${pending.length} uploads in parallel...`);
    pending.forEach((item) => startBatchUploadItem(item.id));
  };

  const handleBatchClear = () => {
    setYoutubeBatchItems([]);
    setEditingBatchItemId('');
    setYoutubeStatus('🧹 Batch queue cleared');
  };

  const openBatchItemEditor = (item) => {
    if (!item) return;
    setEditingBatchItemId(item.id);
    setEditingBatchForm({
      title: item.title || '',
      description: item.description || '',
      tags: item.tags || '',
      privacyStatus: item.privacyStatus || YT_DEFAULT_PRIVACY,
      scheduleEnabled: Boolean(item.scheduleEnabled),
      publishAtLocal: item.publishAtLocal || '',
    });
  };

  const closeBatchItemEditor = () => {
    setEditingBatchItemId('');
  };

  const saveBatchItemEditor = () => {
    if (!editingBatchItemId) return;
    setYoutubeBatchItems((prev) =>
      prev.map((x) =>
        x.id === editingBatchItemId
          ? {
              ...x,
              title: editingBatchForm.title,
              description: editingBatchForm.description,
              tags: editingBatchForm.tags,
              privacyStatus: editingBatchForm.privacyStatus,
              scheduleEnabled: Boolean(editingBatchForm.scheduleEnabled),
              publishAtLocal: editingBatchForm.publishAtLocal,
            }
          : x
      )
    );
    setYoutubeStatus('✅ Batch item metadata updated');
  };

  const handleSaveYoutubeCredentials = async () => {
    if (!youtubeCredentials.clientId || !youtubeCredentials.clientSecret) {
      setYoutubeStatus('❌ Please enter both Client ID and Client Secret');
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
      setYoutubeStatus('✅ Profile saved! Make sure the redirect URI in Google Cloud Console matches exactly: ' + redirectUri);
      setShowCredentialsForm(false);
    } catch (error) {
      setYoutubeStatus(`❌ Failed to save credentials: ${error.message}`);
    }
  };

  const handleYoutubeAuthenticate = () => {
    if (!selectedYoutubeProfileId) {
      setYoutubeStatus('❌ Please create/select a YouTube profile first');
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
      setYoutubeStatus('❌ Please enter the authorization code');
      return;
    }
    
    if (!selectedYoutubeProfileId) {
      setYoutubeStatus('❌ Please create/select a YouTube profile first');
      return;
    }

    setYoutubeStatus('⏳ Verifying authorization code...');
    window.electronAPI.youtubeSendAuthCode(selectedYoutubeProfileId, code);
    setShowAuthCodeInput(false);
    setYoutubeAuthCode('');
  };

  const handleYoutubeLogout = async () => {
    try {
      if (!selectedYoutubeProfileId) {
        setYoutubeStatus('❌ Please select a YouTube profile first');
        return;
      }
      await window.electronAPI.youtubeLogoutProfile(selectedYoutubeProfileId);
      setYoutubeAuthenticated(false);
      setYoutubeStatus('✅ Logged out successfully');
    } catch (error) {
      setYoutubeStatus(`❌ Failed to logout: ${error.message}`);
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
      setYoutubeStatus('✅ YouTube profiles reset. Please create a profile and authenticate again.');
    } catch (error) {
      setYoutubeStatus(`❌ Failed to reset OAuth: ${error.message}`);
    }
  };

  const handleYoutubeDeleteProfile = async () => {
    if (!selectedYoutubeProfileId) {
      setYoutubeStatus('❌ Please select a YouTube profile first');
      return;
    }
    const ok = window.confirm('Delete the selected YouTube profile and its token from this computer?');
    if (!ok) return;
    try {
      await window.electronAPI.youtubeDeleteProfile(selectedYoutubeProfileId);
      setYoutubeAuthenticated(false);
      await refreshYoutubeProfiles('');
      setYoutubeStatus('✅ Profile deleted');
    } catch (error) {
      setYoutubeStatus(`❌ Failed to delete profile: ${error.message}`);
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

  // (Single uploader removed; batch uploader is used instead)

  const handleSelectImage = async () => {
    const path = await window.electronAPI.selectSingleImage();
    if (path) {
      setImagePath(path);
      setScrollingStatus('');
    }
  };

  const handleSelectMultipleImages = async () => {
    const paths = await window.electronAPI.selectMultipleImages();
    if (paths && paths.length > 0) {
      setImagePaths(paths);
      setScrollingStatus('');
    }
  };

  const handleSelectVideo = async () => {
    const path = await window.electronAPI.selectVideo();
    if (path) {
      setVideoPath(path);
      setScrollingStatus('');
    }
  };

  const handleSelectAudio = async () => {
    const path = await window.electronAPI.selectAudio();
    if (path) {
      setBackgroundMusic(prev => ({ ...prev, path, enabled: true }));
      setScrollingStatus('');
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
        setScrollingStatus(`✅ Subtitle file loaded: ${subtitleData.items?.length || 0} subtitles`);
      } catch (error) {
        setScrollingStatus(`❌ Failed to load subtitle file: ${error.message}`);
      }
    }
  };

  const handleSelectOutputDirectory = async () => {
    const path = await window.electronAPI.selectOutputDirectory();
    if (path) {
      setOutputDirectory(path);
      setScrollingStatus('');
    }
  };

  const handleSelectPanZoomImageFolder = async () => {
    const path = await window.electronAPI.selectImageFolder();
    if (path) {
      setPanZoomImageFolder(path);
      setPanZoomStatus('');
    }
  };

  const handleSelectPanZoomOutputFolder = async () => {
    const path = await window.electronAPI.selectOutputDirectory();
    if (path) {
      setPanZoomOutputFolder(path);
      setPanZoomStatus('');
    }
  };

  const handleSelectPanZoomAudio = async () => {
    const path = await window.electronAPI.selectAudio();
    if (path) {
      setPanZoomBackgroundMusic(prev => ({ ...prev, path, enabled: true }));
      setPanZoomStatus('');
    }
  };

  const handleSelectEffectImageFolder = async () => {
    const path = await window.electronAPI.selectImageFolder();
    if (path) {
      setEffectImageFolder(path);
      setEffectStatus('');
    }
  };

  const handleSelectEffectOutputFolder = async () => {
    const path = await window.electronAPI.selectOutputDirectory();
    if (path) {
      setEffectOutputFolder(path);
      setEffectStatus('');
    }
  };

  const handleSelectEffectAudio = async () => {
    const path = await window.electronAPI.selectAudio();
    if (path) {
      setEffectBackgroundMusic(prev => ({ ...prev, path, enabled: true }));
      setEffectStatus('');
    }
  };

  const handleGeneratePanZoomVideo = () => {
    if (!panZoomImageFolder) {
      setPanZoomStatus('❌ Please select an image folder');
      return;
    }

    if (!panZoomOutputFolder) {
      setPanZoomStatus('❌ Please select an output folder');
      return;
    }

    setIsPanZoomGenerating(true);
    setPanZoomProgress(0);
    setPanZoomProgressMessage('Initializing...');
    setPanZoomStatus('🎬 Generating pan/zoom videos...');

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

  const handleGenerateEffectVideo = () => {
    if (!effectImageFolder) {
      setEffectStatus('❌ Please select an image folder');
      return;
    }

    if (!effectOutputFolder) {
      setEffectStatus('❌ Please select an output folder');
      return;
    }

    setIsEffectGenerating(true);
    setEffectProgress(0);
    setEffectProgressMessage('Initializing...');
    setEffectStatus('🎬 Generating effect videos...');

    const options = {
      imageFolder: effectImageFolder,
      outputFolder: effectOutputFolder,
      videoWidth: parseInt(effectVideoWidth),
      videoHeight: parseInt(effectVideoHeight),
      fps: parseInt(effectFps),
      imageDuration: parseFloat(effectImageDuration),
      batchSize: parseInt(effectBatchSize),
      effectPreset,
      transition: {
        type: effectTransitionType,
        duration: parseFloat(effectTransitionDuration),
      },
      backgroundMusic: effectBackgroundMusic.enabled && effectBackgroundMusic.path ? effectBackgroundMusic : null,
    };

    window.electronAPI.generateEffectVideo(options);
  };

  const handleCancelPanZoomVideo = () => {
    window.electronAPI.cancelPanZoomVideo();
    setIsPanZoomGenerating(false);
    setPanZoomProgress(0);
    setPanZoomProgressMessage('');
    setPanZoomStatus('⚠️ Video generation cancelled');
  };

  const handleCancelEffectVideo = () => {
    window.electronAPI.cancelEffectVideo();
    setIsEffectGenerating(false);
    setEffectProgress(0);
    setEffectProgressMessage('');
    setEffectStatus('⚠️ Effect video generation cancelled');
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

  const handleEffectSocialPreset = (preset) => {
    setEffectSocialPreset(preset);
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
      setEffectVideoWidth(presets[preset].width);
      setEffectVideoHeight(presets[preset].height);
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
      setScrollingStatus(`✅ Project saved: ${path}`);
    } catch (error) {
      setScrollingStatus(`❌ Failed to save project: ${error.message}`);
    }
  };

  const handleLoadProject = async () => {
    try {
      const config = await window.electronAPI.loadProject();
      loadConfig(config);
      setScrollingStatus(`✅ Project loaded successfully`);
    } catch (error) {
      setScrollingStatus(`❌ Failed to load project: ${error.message}`);
    }
  };

  const buildConfig = () => {
    const resolvedVoiceName =
      audioProvider === 'system'
        ? (selectedTtsVoiceName || null)
        : audioProvider === 'xtts'
          ? (selectedXttsVoiceId || null)
          : null;
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
        provider: audioProvider,
        voiceName: resolvedVoiceName,
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
      if (config.narration.provider) setAudioProvider(config.narration.provider);
      if (config.narration.voiceName) {
        // Apply to the correct provider bucket
        const p = (config.narration.provider || '').toLowerCase();
        if (p === 'system') setSelectedTtsVoiceName(config.narration.voiceName);
        if (p === 'xtts') setSelectedXttsVoiceId(config.narration.voiceName);
      }
    }
  };

  const handleGenerate = () => {
    // Validation
    if (!imagePath && imagePaths.length === 0 && !videoPath && !backgroundGradient.enabled) {
      setScrollingStatus('❌ Please select a background image, video, or enable gradient background');
      return;
    }

    if (!text.trim() && (!texts || texts.every(t => !t.text || !t.text.trim()))) {
      setScrollingStatus('❌ Please enter text to scroll');
      return;
    }

    if (width <= 0 || height <= 0) {
      setScrollingStatus('❌ Width and height must be greater than 0');
      return;
    }

    if (scrollSpeed <= 0) {
      setScrollingStatus('❌ Scroll speed must be greater than 0');
      return;
    }

    if (fontSize <= 0) {
      setScrollingStatus('❌ Font size must be greater than 0');
      return;
    }

    // Start generation
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Initializing...');
    setAudioProgress(0);
    setAudioProgressMessage('');
    setVideoProgress(0);
    setVideoProgressMessage('');
    setScrollingStatus('🎬 Generating video...');
    resetScrollingTiming();

    const options = buildConfig();
    window.electronAPI.generateScrollingVideo(options);
  };

  const handleCancel = () => {
    window.electronAPI.cancelScrollingVideo();
    setIsGenerating(false);
    setProgress(0);
    setProgressMessage('');
    setScrollingEtaSec(null);
    setScrollingStatus('⚠️ Video generation cancelled');
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

  const studioState = {
    // Tabs
    activeMainTab,
    activeSettingsTab,

    // Advanced generator state
    imagePath,
    imagePaths,
    videoPath,
    text,
    audioText,
    audioLanguage,
    audioProvider,
    ttsVoices,
    selectedTtsVoiceName,
    xttsVoices,
    xttsVoicesError,
    xttsVoicesLoading,
    selectedXttsVoiceId,
    width,
    height,
    scrollSpeed,
    scrollDirection,
    textColor,
    fontSize,
    fontFamily,
    fps,
    textEffects,
    textAnimation,
    backgroundGradient,
    overlayOpacity,
    imageFilter,
    colorAdjustments,
    backgroundCrop,
    backgroundRotation,
    backgroundMusic,
    slides,
    useMultiSlide,
    exportFormat,
    qualityPreset,
    bitrate,
    outputDirectory,
    exportGif,
    exportImageSequence,
    exportThumbnail,
    subtitles,
    socialPreset,

    // Progress/UI
    isGenerating,
    progress,
    progressMessage,
    audioProgress,
    audioProgressMessage,
    videoProgress,
    videoProgressMessage,
    scrollingElapsedSec,
    scrollingEtaSec,
    scrollingStatus,

    // Pan/Zoom
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

    // Effects
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

    // YouTube
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
  };

  const studioActions = {
    // Tabs
    setActiveMainTab,
    setActiveSettingsTab,

    // Advanced setters
    setText,
    setAudioText,
    setAudioLanguage,
    setAudioProvider,
    setSelectedTtsVoiceName,
    setSelectedXttsVoiceId,
    setWidth,
    setHeight,
    setScrollSpeed,
    setScrollDirection,
    setTextColor,
    setFontSize,
    setFontFamily,
    setFps,
    setTextEffects,
    setTextAnimation,
    setBackgroundGradient,
    setOverlayOpacity,
    setImageFilter,
    setColorAdjustments,
    setBackgroundCrop,
    setBackgroundRotation,
    setBackgroundMusic,
    setSlides,
    setUseMultiSlide,
    setExportFormat,
    setQualityPreset,
    setBitrate,
    setOutputDirectory,
    setExportGif,
    setExportImageSequence,
    setExportThumbnail,
    setSubtitles,
    setSocialPreset,

    // Advanced handlers
    handleSaveProject,
    handleLoadProject,
    handleSelectImage,
    handleSelectMultipleImages,
    handleSelectVideo,
    handleSelectAudio,
    handleSelectSubtitle,
    handleSelectOutputDirectory,
    handleSocialPreset,
    handleGenerate,
    handleCancel,

    // Pan/Zoom setters + handlers
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
    handleSelectPanZoomAudio,
    handleGeneratePanZoomVideo,
    handleCancelPanZoomVideo,
    handlePanZoomSocialPreset,

    // Effects setters + handlers
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
    handleSelectEffectAudio,
    handleGenerateEffectVideo,
    handleCancelEffectVideo,
    handleEffectSocialPreset,

    // YouTube setters
    setYoutubeProfiles,
    setSelectedYoutubeProfileId,
    setYoutubeAuthenticated,
    setYoutubeProfileLabel,
    setYoutubeCredentials,
    setShowCredentialsForm,
    setYoutubeAuthCode,
    setShowAuthCodeInput,
    setYoutubeBatchItems,
    setEditingBatchItemId,
    setEditingBatchForm,
    setYoutubeStatus,

    // YouTube handlers
    handleYoutubeSelectProfile,
    handleSelectYoutubeVideosBatch,
    handleYoutubeAuthenticate,
    handleYoutubeAuthCodeSubmit,
    handleSaveYoutubeCredentials,
    handleYoutubeLogout,
    handleYoutubeResetAuth,
    handleYoutubeDeleteProfile,
    handleBatchUploadAllParallel,
    handleBatchClear,
    openBatchItemEditor,
    closeBatchItemEditor,
    saveBatchItemEditor,
    startBatchUploadItem,
  };

  const studioConstants = {
    fontFamilies,
    narrationLanguages,
    animationTypes,
    scrollDirections,
    imageFilters,
    qualityPresets,
    exportFormats,
    socialPresets,
  };

  return (
    <StudioContext.Provider value={{ state: studioState, actions: studioActions, constants: studioConstants }}>
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
            className={`main-tab-button ${activeMainTab === 'effects' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('effects')}
            disabled={isGenerating}
          >
            ✨ Effect generator
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
        {activeMainTab === 'advanced' && <AdvancedTab />}

        {/* Video Generator Tab */}
        {activeMainTab === 'video' && <PanZoomTab />}

        {/* Effect Generator Tab */}
        {activeMainTab === 'effects' && <EffectsTab />}

        {/* Video Uploader Tab */}
        {activeMainTab === 'uploader' && <UploaderTab />}
      </div>
    </StudioContext.Provider>
  );
}

export default ScrollingTextVideo;
