
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Track, TrackType, DAWState, ProjectPhase, PluginInstance, PluginType, MobileTab, TrackSend, Clip, AIAction, AutomationLane, AIChatMessage, ViewMode, User, Theme, DrumPad } from './types';
import { audioEngine } from './engine/AudioEngine';
import TransportBar from './components/TransportBar';
import SideBrowser from './components/SideBrowser';
import ArrangementView from './components/ArrangementView';
import MixerView from './components/MixerView';
import PluginEditor from './components/PluginEditor';
import ChatAssistant from './components/ChatAssistant';
import ViewModeSwitcher from './components/ViewModeSwitcher';
import ContextMenu from './components/ContextMenu';
import TouchInteractionManager from './components/TouchInteractionManager';
import GlobalClipMenu from './components/GlobalClipMenu'; 
import TrackCreationBar from './components/TrackCreationBar';
import AuthScreen from './components/AuthScreen';
import AutomationEditorView from './components/AutomationEditorView';
import ShareModal from './components/ShareModal';
import SaveProjectModal from './components/SaveProjectModal';
import LoadProjectModal from './components/LoadProjectModal';
import ExportModal from './components/ExportModal'; 
import AudioSettingsPanel from './components/AudioSettingsPanel'; 
import PluginManager from './components/PluginManager'; 
import { supabaseManager } from './services/SupabaseManager';
import { SessionSerializer } from './services/SessionSerializer';
import { getAIProductionAssistance } from './services/AIService';
import { novaBridge } from './services/NovaBridge';
import { ProjectIO } from './services/ProjectIO';
import PianoRoll from './components/PianoRoll';
import { midiManager } from './services/MidiManager';
import { AUDIO_CONFIG, UI_CONFIG, NOTES } from './utils/constants'; // FIX: Removed SCALES import from deleted file
import { generateId } from './utils/helpers';

// Menu FX vide (Tous les effets internes sont supprimés)
const AVAILABLE_FX_MENU: { id: string, name: string, icon: string }[] = [];

const createDefaultAutomation = (param: string, color: string): AutomationLane => ({
  id: generateId('auto'),
  parameterName: param, points: [], color: color, isExpanded: false, min: 0, max: 1.5
});

const createDefaultPlugins = (type: PluginType, mix: number = 0.3, bpm: number = 120, paramsOverride: any = {}): PluginInstance => {
  let params: any = { isEnabled: true };
  let name: string = type;

  // Uniquement les instruments supportés
  switch (type) {
    case 'MELODIC_SAMPLER':
        name = 'Melodic Sampler';
        params = { rootKey: 60, fineTune: 0, glide: 0.05, loop: true, loopStart: 0, loopEnd: 1, attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5, filterCutoff: 20000, filterRes: 0, velocityToFilter: 0.5, lfoRate: 4, lfoAmount: 0, lfoDest: 'PITCH', saturation: 0, bitCrush: 0, chorus: 0, width: 0.5, isEnabled: true };
        break;
    case 'DRUM_SAMPLER':
        name = 'Drum Sampler';
        params = { gain: 0, transpose: 0, fineTune: 0, sampleStart: 0, sampleEnd: 1, attack: 0.005, hold: 0.05, decay: 0.2, sustain: 0, release: 0.1, cutoff: 20000, resonance: 0, pan: 0, velocitySens: 0.8, reverse: false, normalize: false, chokeGroup: 1, isEnabled: true };
        break;
  }

  params = { ...params, ...paramsOverride };
  return { id: generateId('pl'), name, type, isEnabled: true, params, latency: 0 };
};

// Pistes Send VIERGES (Sans Delay/Reverb)
const createInitialSends = (bpm: number): Track[] => [
  { id: 'send-a', name: 'SEND A', type: TrackType.SEND, color: '#00f2ff', isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false, volume: 1.0, pan: 0, outputTrackId: 'master', sends: [], clips: [], plugins: [], automationLanes: [createDefaultAutomation('volume', '#00f2ff')], totalLatency: 0 },
  { id: 'send-b', name: 'SEND B', type: TrackType.SEND, color: '#6366f1', isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false, volume: 1.0, pan: 0, outputTrackId: 'master', sends: [], clips: [], plugins: [], automationLanes: [createDefaultAutomation('volume', '#6366f1')], totalLatency: 0 },
];

// Bus Vox VIERGE (Sans Compresseur)
const createBusVox = (defaultSends: TrackSend[], bpm: number): Track => ({
  id: 'bus-vox', name: 'BUS VOX', type: TrackType.BUS, color: '#fbbf24', isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false, volume: 1.0, pan: 0, outputTrackId: 'master', sends: [...defaultSends], clips: [], plugins: [], automationLanes: [createDefaultAutomation('volume', '#fbbf24')], totalLatency: 0
});

const SaveOverlay: React.FC<{ progress: number; message: string }> = ({ progress, message }) => (
  <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
    <div className="w-64 space-y-4 text-center">
      <div className="w-16 h-16 mx-auto rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin"></div>
      <h3 className="text-xl font-black text-white uppercase tracking-widest">{message}</h3>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  </div>
);

const MobileBottomNav: React.FC<{ activeTab: MobileTab, onTabChange: (tab: MobileTab) => void }> = ({ activeTab, onTabChange }) => (
    <div className="h-16 bg-[#0c0d10] border-t border-white/10 flex items-center justify-around z-50">
        <button onClick={() => onTabChange('PROJECT')} className={`flex flex-col items-center space-y-1 ${activeTab === 'PROJECT' ? 'text-cyan-400' : 'text-slate-500'}`}>
            <i className="fas fa-project-diagram text-lg"></i>
            <span className="text-[9px] font-black uppercase">Arrangement</span>
        </button>
        <button onClick={() => onTabChange('MIXER')} className={`flex flex-col items-center space-y-1 ${activeTab === 'MIXER' ? 'text-cyan-400' : 'text-slate-500'}`}>
            <i className="fas fa-sliders-h text-lg"></i>
            <span className="text-[9px] font-black uppercase">Mixer</span>
        </button>
        <button onClick={() => onTabChange('NOVA')} className={`flex flex-col items-center space-y-1 ${activeTab === 'NOVA' ? 'text-cyan-400' : 'text-slate-500'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 -mt-6 border-4 border-[#0c0d10]">
                <i className="fas fa-robot text-white text-lg"></i>
            </div>
            <span className="text-[9px] font-black uppercase">AI Nova</span>
        </button>
        <button onClick={() => onTabChange('BROWSER')} className={`flex flex-col items-center space-y-1 ${activeTab === 'BROWSER' ? 'text-cyan-400' : 'text-slate-500'}`}>
            <i className="fas fa-folder text-lg"></i>
            <span className="text-[9px] font-black uppercase">Browser</span>
        </button>
        <button onClick={() => onTabChange('AUTOMATION')} className={`flex flex-col items-center space-y-1 ${activeTab === 'AUTOMATION' ? 'text-cyan-400' : 'text-slate-500'}`}>
            <i className="fas fa-wave-square text-lg"></i>
            <span className="text-[9px] font-black uppercase">Auto</span>
        </button>
    </div>
);

const useUndoRedo = (initialState: DAWState) => {
  const [history, setHistory] = useState<{ past: DAWState[]; present: DAWState; future: DAWState[]; }>({ past: [], present: initialState, future: [] });
  const MAX_HISTORY = 100;
  const setState = useCallback((updater: DAWState | ((prev: DAWState) => DAWState)) => {
    setHistory(curr => {
      const newState = typeof updater === 'function' ? updater(curr.present) : updater;
      if (newState === curr.present) return curr;
      const isTimeUpdateOnly = newState.currentTime !== curr.present.currentTime && newState.tracks === curr.present.tracks && newState.isPlaying === curr.present.isPlaying;
      if (isTimeUpdateOnly) return { ...curr, present: newState };
      return { past: [...curr.past, curr.present].slice(-MAX_HISTORY), present: newState, future: [] };
    });
  }, []);
  const setVisualState = useCallback((updater: Partial<DAWState>) => { setHistory(curr => ({ ...curr, present: { ...curr.present, ...updater } })); }, []);
  const undo = useCallback(() => { setHistory(curr => { if (curr.past.length === 0) return curr; return { past: curr.past.slice(0, -1), present: curr.past[curr.past.length - 1], future: [curr.present, ...curr.future] }; }); }, []);
  const redo = useCallback(() => { setHistory(curr => { if (curr.future.length === 0) return curr; return { past: [...curr.past, curr.present], present: curr.future[0], future: curr.future.slice(1) }; }); }, []);
  return { state: history.present, setState, setVisualState, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
};

export default function App() {
  const [user, setUser] = useState<User | null>(null); 
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [saveState, setSaveState] = useState<{ isSaving: boolean; progress: number; message: string }>({ isSaving: false, progress: 0, message: '' });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [exportModal, setExportModal] = useState<{ type: 'FRAUD' | 'RECORDING', link: string, message: string } | null>(null);
  const [browserWidth, setBrowserWidth] = useState(320); 
  const [isResizingBrowser, setIsResizingBrowser] = useState(false);
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false); 
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false); 
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [midiEditorOpen, setMidiEditorOpen] = useState<{trackId: string, clipId: string} | null>(null);
  const [noArmedTrackError, setNoArmedTrackError] = useState(false);

  useEffect(() => {
      const u = supabaseManager.getUser();
      if(u) setUser(u);
  }, []);

  // --- ETAT INITIAL NETTOYÉ ---
  const initialState: DAWState = {
    id: 'proj-1', name: 'STUDIO_SESSION', bpm: AUDIO_CONFIG.DEFAULT_BPM, isPlaying: false, isRecording: false, currentTime: 0,
    isLoopActive: false, loopStart: 0, loopEnd: 0,
    tracks: [
      { id: 'instrumental', name: 'BEAT', type: TrackType.AUDIO, color: '#eab308', isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false, volume: 0.7, pan: 0, outputTrackId: 'master', sends: createInitialSends(AUDIO_CONFIG.DEFAULT_BPM).map(s => ({ id: s.id, level: 0, isEnabled: true })), clips: [], plugins: [], automationLanes: [createDefaultAutomation('volume', '#eab308')], totalLatency: 0 },
      { id: 'track-rec-main', name: 'REC', type: TrackType.AUDIO, color: '#ff0000', isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false, volume: 1.0, pan: 0, outputTrackId: 'bus-vox', sends: createInitialSends(AUDIO_CONFIG.DEFAULT_BPM).map(s => ({ id: s.id, level: 0, isEnabled: true })), clips: [], plugins: [], automationLanes: [createDefaultAutomation('volume', '#ff0000')], totalLatency: 0 },
      // SUPPRESSION DE LA PISTE MIDI PAR DEFAUT QUI CONTENAIT DES EFFETS
      createBusVox(createInitialSends(AUDIO_CONFIG.DEFAULT_BPM).map(s => ({ id: s.id, level: 0, isEnabled: true })), AUDIO_CONFIG.DEFAULT_BPM), 
      ...createInitialSends(AUDIO_CONFIG.DEFAULT_BPM)
    ],
    selectedTrackId: 'track-rec-main', currentView: 'ARRANGEMENT', projectPhase: ProjectPhase.SETUP, isLowLatencyMode: false, isRecModeActive: false, systemMaxLatency: 0, recStartTime: null,
    isDelayCompEnabled: false
  };

  const { state, setState, setVisualState, undo, redo, canUndo, canRedo } = useUndoRedo(initialState);
  
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => { setTheme(prev => prev === 'dark' ? 'light' : 'dark'); };

  useEffect(() => { novaBridge.connect(); }, []);
  const stateRef = useRef(state); 
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { if (audioEngine.ctx) state.tracks.forEach(t => audioEngine.updateTrack(t, state.tracks)); }, [state.tracks]); 
  
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      if (stateRef.current.isPlaying) {
         const time = audioEngine.getCurrentTime();
         setVisualState({ currentTime: time });
         animId = requestAnimationFrame(updateLoop);
      }
    };
    if (state.isPlaying) {
        animId = requestAnimationFrame(updateLoop);
    }
    return () => cancelAnimationFrame(animId);
  }, [state.isPlaying, setVisualState]);

  const [activePlugin, setActivePlugin] = useState<{trackId: string, plugin: PluginInstance} | null>(null);
  const [sideTab, setSideTab] = useState<'local' | 'nova' | 'store'>('store');
  const [shouldFocusSearch, setShouldFocusSearch] = useState(false);
  const [externalImportNotice, setExternalImportNotice] = useState<string | null>(null);
  const [aiNotification, setAiNotification] = useState<string | null>(null);
  const [addPluginMenu, setAddPluginMenu] = useState<{ trackId: string, x: number, y: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('nova_view_mode');
    if (saved) return saved as ViewMode;
    return window.innerWidth < 768 ? 'MOBILE' : (window.innerWidth < 1024 ? 'TABLET' : 'DESKTOP');
  });
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('PROJECT');
  const handleViewModeChange = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem('nova_view_mode', mode); };
  useEffect(() => { document.body.setAttribute('data-view-mode', viewMode); }, [viewMode]);
  const isMobile = viewMode === 'MOBILE';
  const ensureAudioEngine = async () => { if (!audioEngine.ctx) await audioEngine.init(); if (audioEngine.ctx?.state === 'suspended') await audioEngine.ctx.resume(); };

  const handleLogout = async () => { await supabaseManager.signOut(); setUser(null); };
  const handleBuyLicense = (instrumentId: number) => { if (!user) return; const updatedUser = { ...user, owned_instruments: [...(user.owned_instruments || []), instrumentId] }; setUser(updatedUser); setAiNotification(`✅ Licence achetée avec succès ! Export débloqué.`); };
  
  const handleSaveCloud = async (projectName: string) => {
      // Implement save logic here
  };
  
  const handleSaveLocal = async (name: string) => {
      // Implement save logic here
  };

  const handleSaveAsCopy = async (name: string) => {
      // Implement save logic here
  };

  const handleLoadCloud = async (id: string) => {
      // Implement load logic here
  };

  const handleLoadLocalFile = async (file: File) => {
      // Implement load logic here
  };

  const handleExportMix = async () => {
      setIsExportMenuOpen(true);
  };

  const handleEditClip = (trackId: string, clipId: string, action: string, payload?: any) => {
    setState(prev => {
      const track = prev.tracks.find(t => t.id === trackId);
      if (!track) return prev;
      let newClips = [...track.clips];
      const idx = newClips.findIndex(c => c.id === clipId);
      if (idx === -1 && action !== 'PASTE') return prev; 
      
      switch(action) {
        case 'MOVE': if(idx > -1) newClips[idx] = { ...newClips[idx], start: payload.start }; break;
        case 'UPDATE_PROPS': if(idx > -1) newClips[idx] = { ...newClips[idx], ...payload }; break;
        case 'DELETE': if(idx > -1) newClips.splice(idx, 1); break;
        case 'MUTE': if(idx > -1) newClips[idx] = { ...newClips[idx], isMuted: !newClips[idx].isMuted }; break;
        case 'DUPLICATE': if(idx > -1) newClips.push({ ...newClips[idx], id: generateId('clip'), start: newClips[idx].start + newClips[idx].duration + 0.1 }); break;
        case 'RENAME': if(idx > -1) newClips[idx] = { ...newClips[idx], name: payload.name }; break;
        case 'SPLIT': 
            if(idx > -1) {
              const clip = newClips[idx];
              const splitTime = payload.time;
              if (splitTime > clip.start && splitTime < clip.start + clip.duration) {
                  const firstDuration = splitTime - clip.start;
                  const secondDuration = clip.duration - firstDuration;
                  newClips[idx] = { ...clip, duration: firstDuration };
                  newClips.push({ ...clip, id: generateId('clip'), start: splitTime, duration: secondDuration, offset: clip.offset + firstDuration });
              }
            }
            break;
      }
      return { ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, clips: newClips } : t) };
    });
  };

  const handleUpdateBpm = useCallback((newBpm: number) => { setState(prev => ({ ...prev, bpm: Math.max(20, Math.min(999, newBpm)) })); }, [setState]);
  const handleUpdateTrack = useCallback((t: Track) => { setState(prev => ({ ...prev, tracks: prev.tracks.map(trk => trk.id === t.id ? t : trk) })); }, [setState]);
  
  const handleUpdatePluginParams = useCallback((trackId: string, pluginId: string, params: Record<string, any>) => {
    setState(prev => {
      const newTracks = prev.tracks.map(t => (t.id !== trackId) ? t : {
          ...t, plugins: t.plugins.map(p => p.id === pluginId ? { ...p, params: { ...p.params, ...params } } : p)
      });
      return { ...prev, tracks: newTracks };
    });
    const pluginNode = audioEngine.getPluginNodeInstance(trackId, pluginId);
    if (pluginNode && pluginNode.updateParams) { pluginNode.updateParams(params); }
  }, [setState]);

  const handleSeek = useCallback((time: number) => { setVisualState({ currentTime: time }); audioEngine.seekTo(time, stateRef.current.tracks, stateRef.current.isPlaying); }, [setVisualState]);
  
  const handleTogglePlay = useCallback(async () => { 
      await ensureAudioEngine();
      stateRef.current.tracks.forEach(t => audioEngine.updateTrack(t, stateRef.current.tracks));
      if (!stateRef.current.isPlaying) { 
          audioEngine.startPlayback(stateRef.current.currentTime, stateRef.current.tracks); 
          setVisualState({ isPlaying: true }); 
      } else { 
          audioEngine.stopAll(); 
          setVisualState({ isPlaying: false }); 
      } 
  }, [setVisualState]);
  
  const handleStop = useCallback(async () => {
    audioEngine.stopAll();
    audioEngine.seekTo(0, stateRef.current.tracks, false); 
    setVisualState({ isPlaying: false, isRecording: false, currentTime: 0 });
  }, [setVisualState]);

  const handleDuplicateTrack = useCallback((trackId: string) => {
      setState(prev => {
          const track = prev.tracks.find(t => t.id === trackId);
          if (!track) return prev;
          const newTrack = { 
              ...track, 
              id: generateId('track'), 
              name: `${track.name} (Copy)`,
              clips: track.clips.map(c => ({ ...c, id: generateId('clip') })) 
          };
          return { ...prev, tracks: [...prev.tracks, newTrack] };
      });
  }, [setState]);

  const handleCreateTrack = useCallback((type: TrackType, name?: string, initialPluginType?: PluginType) => {
      setState(prev => {
          let drumPads: DrumPad[] | undefined = undefined;
          
          if (type === TrackType.DRUM_RACK) {
              drumPads = Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                name: `Pad ${i + 1}`,
                sampleName: 'Empty',
                volume: 0.8,
                pan: 0,
                isMuted: false,
                isSolo: false,
                midiNote: 60 + i
              }));
          }

          const plugins: PluginInstance[] = [];
          if (initialPluginType) {
               plugins.push(createDefaultPlugins(initialPluginType, 1.0, prev.bpm));
          }

          const newTrack: Track = {
              id: generateId('track'),
              name: name || `${type} TRACK`,
              type,
              color: UI_CONFIG.TRACK_COLORS[prev.tracks.length % UI_CONFIG.TRACK_COLORS.length],
              isMuted: false, isSolo: false, isTrackArmed: false, isFrozen: false,
              volume: 1.0, pan: 0, outputTrackId: 'master',
              sends: createInitialSends(prev.bpm).map(s => ({ id: s.id, level: 0, isEnabled: true })),
              clips: [], 
              plugins, 
              automationLanes: [], 
              totalLatency: 0,
              drumPads
          };
          return { ...prev, tracks: [...prev.tracks, newTrack] };
      });
  }, [setState]);

  const handleDeleteTrack = useCallback((trackId: string) => {
      setState(prev => ({
          ...prev,
          tracks: prev.tracks.filter(t => t.id !== trackId),
          selectedTrackId: prev.selectedTrackId === trackId ? null : prev.selectedTrackId
      }));
  }, [setState]);

  const handleRemovePlugin = useCallback((tid: string, pid: string) => {
      setState(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === tid ? { ...t, plugins: t.plugins.filter(p => p.id !== pid) } : t)
      }));
      if (activePlugin?.plugin.id === pid) setActivePlugin(null);
  }, [setState, activePlugin]);

  const handleAddPluginFromContext = (tid: string, type: PluginType) => {
      setState(prev => {
          const track = prev.tracks.find(t => t.id === tid);
          if (!track) return prev;
          const newPlugin = createDefaultPlugins(type, 0.5, prev.bpm);
          return { ...prev, tracks: prev.tracks.map(t => t.id === tid ? { ...t, plugins: [...t.plugins, newPlugin] } : t) };
      });
  };

  const handleDropPlugin = useCallback((tid: string, type: PluginType, meta?: any) => {
      handleAddPluginFromContext(tid, type);
  }, [setState]);
  
  const handleUniversalAudioImport = async (source: string | File, name: string) => {
      // Import logic
  };

  const handleBrowserResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = browserWidth;
      setIsResizingBrowser(true);
      
      const onMove = (m: MouseEvent) => {
          const delta = m.clientX - startX;
          setBrowserWidth(Math.max(200, Math.min(600, startWidth + delta)));
      };
      
      const onUp = () => {
          setIsResizingBrowser(false);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
      };
      
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
  };

  const handleMoveClip = useCallback((sourceTrackId: string, destTrackId: string, clipId: string) => {
      setState(prev => {
          const sourceTrack = prev.tracks.find(t => t.id === sourceTrackId);
          const destTrack = prev.tracks.find(t => t.id === destTrackId);
          if (!sourceTrack || !destTrack) return prev;
          
          const clip = sourceTrack.clips.find(c => c.id === clipId);
          if (!clip) return prev;
          
          const newSourceClips = sourceTrack.clips.filter(c => c.id !== clipId);
          const newDestClips = [...destTrack.clips, { ...clip }]; 
          
          const newTracks = prev.tracks.map(t => {
              if (t.id === sourceTrackId) return { ...t, clips: newSourceClips };
              if (t.id === destTrackId) return { ...t, clips: newDestClips };
              return t;
          });
          
          return { ...prev, tracks: newTracks };
      });
  }, [setState]);

  const handleCreatePatternAndOpen = useCallback((trackId: string, time: number) => {
      const newClipId = generateId('clip-midi');
      const newClip: Clip = {
          id: newClipId,
          name: 'Pattern MIDI',
          start: time,
          duration: 4, 
          offset: 0,
          fadeIn: 0,
          fadeOut: 0,
          type: TrackType.MIDI,
          color: '#22c55e',
          notes: []
      };
      
      setState(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t)
      }));
      
      setMidiEditorOpen({ trackId, clipId: newClipId });
  }, [setState]);

  const handleSwapInstrument = useCallback((trackId: string) => {
      setSideTab('nova'); // Point to Bridge instead of internal FX
      setShouldFocusSearch(true);
  }, []);

  const handleAddBus = useCallback(() => {
      handleCreateTrack(TrackType.BUS, "Group Bus");
  }, [handleCreateTrack]);

  const handleToggleBypass = useCallback((trackId: string, pluginId: string) => {
      setState(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === trackId ? {
              ...t,
              plugins: t.plugins.map(p => p.id === pluginId ? { ...p, isEnabled: !p.isEnabled } : p)
          } : t)
      }));
      
      const track = stateRef.current.tracks.find(t => t.id === trackId);
      const plugin = track?.plugins.find(p => p.id === pluginId);
      if (plugin) {
          const node = audioEngine.getPluginNodeInstance(trackId, pluginId);
          if (node && node.updateParams) node.updateParams({ isEnabled: !plugin.isEnabled });
      }
  }, [setState]);

  const handleLoadDrumSample = useCallback(async (trackId: string, padId: number, file: File) => {
      try {
          const arrayBuffer = await file.arrayBuffer();
          await ensureAudioEngine();
          const audioBuffer = await audioEngine.ctx!.decodeAudioData(arrayBuffer);
          audioEngine.loadDrumRackSample(trackId, padId, audioBuffer);
          setState(prev => {
              const track = prev.tracks.find(t => t.id === trackId);
              if (!track || !track.drumPads) return prev;
              const newPads = track.drumPads.map(p => 
                  p.id === padId ? { ...p, sampleName: file.name, buffer: audioBuffer } : p
              );
              return { ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, drumPads: newPads } : t) };
          });
      } catch (e) { console.error("Error loading drum sample:", e); }
  }, [setState]);

  // Window DAW Control logic remains
  useEffect(() => {
    (window as any).DAW_CONTROL = {
      play: handleTogglePlay,
      stop: handleStop,
      setBpm: handleUpdateBpm,
      // ... more methods
      addTrack: handleCreateTrack,
      loadDrumSample: handleLoadDrumSample,
      getState: () => stateRef.current
    };
  }, [handleTogglePlay, handleStop, handleUpdateBpm, handleCreateTrack, handleLoadDrumSample]);

  if (!user) { return <AuthScreen onAuthenticated={(u) => { setUser(u); setIsAuthOpen(false); }} />; }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', cursor: isResizingBrowser ? 'col-resize' : 'default' }}>
      {saveState && saveState.isSaving && <SaveOverlay progress={saveState.progress} message={saveState.message} />}

      <div className="relative z-50">
        <TransportBar 
          isPlaying={state.isPlaying} currentTime={state.currentTime} bpm={state.bpm} 
          onBpmChange={handleUpdateBpm} isRecording={state.isRecording} isLoopActive={state.isLoopActive}
          onToggleLoop={() => { /* ... */ }} 
          onStop={handleStop} onTogglePlay={handleTogglePlay} onToggleRecord={() => {}} 
          currentView={state.currentView} onChangeView={v => setState(s => ({ ...s, currentView: v }))} 
          statusMessage={externalImportNotice} noArmedTrackError={noArmedTrackError}
          currentTheme={theme} onToggleTheme={toggleTheme}
          
          onOpenSaveMenu={() => setIsSaveMenuOpen(true)}
          onOpenLoadMenu={() => setIsLoadMenuOpen(true)}
          
          onExportMix={handleExportMix} onShareProject={() => setIsShareModalOpen(true)}
          onOpenAudioEngine={() => setIsAudioSettingsOpen(true)}
          
          isDelayCompEnabled={state.isDelayCompEnabled}
          onToggleDelayComp={() => {}}

          onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
          user={user} onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout}
          showBrowserToggle={!isMobile} isBrowserOpen={browserWidth > 0} onToggleBrowser={() => setBrowserWidth(prev => prev > 0 ? 0 : 320)}
        >
          <div className="ml-4 border-l border-white/5 pl-4"><ViewModeSwitcher currentMode={viewMode} onChange={handleViewModeChange} /></div>
        </TransportBar>
      </div>
      
      <TrackCreationBar onCreateTrack={handleCreateTrack} />
      <TouchInteractionManager />
      <GlobalClipMenu />

      <div className="flex-1 flex overflow-hidden relative">
        {(!isMobile || activeMobileTab === 'BROWSER') && browserWidth > 0 && (
          <aside className={`${isMobile ? 'w-full absolute inset-0 z-40' : ''} transition-none z-20 flex bg-[#08090b]`} style={{ width: isMobile ? '100%' : `${browserWidth}px` }}>
            <div className="flex-1 overflow-hidden relative border-r border-white/5 h-full">
                <SideBrowser 
                    activeTabOverride={sideTab} 
                    onTabChange={setSideTab} 
                    shouldFocusSearch={shouldFocusSearch} 
                    onSearchFocused={() => setShouldFocusSearch(false)} 
                    onAddPlugin={(type, meta) => { 
                        if (state.selectedTrackId) {
                            handleAddPluginFromContext(state.selectedTrackId, type as PluginType);
                        }
                    }} 
                    onLocalImport={(f) => handleUniversalAudioImport(f, f.name.split('.')[0])} 
                    user={user} 
                    onBuyLicense={handleBuyLicense} 
                />
            </div>
            {!isMobile && (<div className="w-1 cursor-col-resize hover:bg-cyan-500/50 active:bg-cyan-500 transition-colors z-50 flex items-center justify-center group h-full" onMouseDown={handleBrowserResizeStart}><div className="w-0.5 h-8 bg-white/20 rounded-full group-hover:bg-white/50" /></div>)}
          </aside>
        )}

        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          {((!isMobile && state.currentView === 'ARRANGEMENT') || (isMobile && activeMobileTab === 'PROJECT')) && (
            <ArrangementView 
               tracks={state.tracks} currentTime={state.currentTime} 
               isLoopActive={state.isLoopActive} loopStart={state.loopStart} loopEnd={state.loopEnd}
               onSetLoop={(start, end) => setState(prev => ({ ...prev, loopStart: start, loopEnd: end, isLoopActive: true }))}
               onSeek={handleSeek} bpm={state.bpm} 
               selectedTrackId={state.selectedTrackId} onSelectTrack={id => setState(p => ({ ...p, selectedTrackId: id }))} 
               onUpdateTrack={handleUpdateTrack} onReorderTracks={() => {}} 
               onDropPluginOnTrack={handleDropPlugin} 
               onSelectPlugin={(tid, p) => { ensureAudioEngine(); setActivePlugin({trackId:tid, plugin:p}); }} 
               onRemovePlugin={handleRemovePlugin} 
               onRequestAddPlugin={(tid, x, y) => setAddPluginMenu({ trackId: tid, x, y })} 
               onAddTrack={handleCreateTrack} onDuplicateTrack={handleDuplicateTrack} onDeleteTrack={handleDeleteTrack} 
               onFreezeTrack={(tid) => {}} onImportFile={(f) => {}}
               onEditClip={handleEditClip} isRecording={state.isRecording} recStartTime={state.recStartTime}
               onMoveClip={handleMoveClip}
               onEditMidi={(trackId, clipId) => setMidiEditorOpen({ trackId, clipId })}
               onCreatePattern={handleCreatePatternAndOpen}
               onSwapInstrument={handleSwapInstrument}
            /> 
          )}
          
          {((!isMobile && state.currentView === 'MIXER') || (isMobile && activeMobileTab === 'MIXER')) && (
             <MixerView 
                tracks={state.tracks} 
                onUpdateTrack={handleUpdateTrack} 
                onOpenPlugin={(tid, p) => setActivePlugin({trackId:tid, plugin:p})} 
                onDropPluginOnTrack={handleDropPlugin}
                onRemovePlugin={handleRemovePlugin}
                onAddBus={handleAddBus}
                onToggleBypass={handleToggleBypass}
                onRequestAddPlugin={(tid, x, y) => setAddPluginMenu({ trackId: tid, x, y })}
             />
          )}
        </main>
      </div>
      
      {isMobile && <MobileBottomNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />}
      
      {activePlugin && (
        <div className={`fixed inset-0 flex items-center justify-center z-[200] ${isMobile ? 'bg-[#0c0d10]' : 'bg-black/60 backdrop-blur-sm'}`} onMouseDown={() => !isMobile && setActivePlugin(null)}>
           <div className={`relative ${isMobile ? 'w-full h-full p-4 overflow-y-auto' : ''}`} onMouseDown={e => e.stopPropagation()}>
              <PluginEditor 
                  plugin={activePlugin.plugin} 
                  trackId={activePlugin.trackId} 
                  onClose={() => setActivePlugin(null)} 
                  onUpdateParams={(p) => handleUpdatePluginParams(activePlugin.trackId, activePlugin.plugin.id, p)} 
                  isMobile={isMobile} 
                  track={state.tracks.find(t => t.id === activePlugin.trackId)} 
                  onUpdateTrack={handleUpdateTrack} 
              />
           </div>
        </div>
      )}
      
      {addPluginMenu && <ContextMenu x={addPluginMenu.x} y={addPluginMenu.y} onClose={() => setAddPluginMenu(null)} items={AVAILABLE_FX_MENU.map(fx => ({ label: fx.name, icon: fx.icon, onClick: () => handleAddPluginFromContext(addPluginMenu.trackId, fx.id as PluginType) }))} />}

      {midiEditorOpen && state.tracks.find(t => t.id === midiEditorOpen.trackId) && (
          <div className="fixed inset-0 z-[250] bg-[#0c0d10] flex flex-col animate-in slide-in-from-bottom-10 duration-200">
             <PianoRoll 
                 track={state.tracks.find(t => t.id === midiEditorOpen.trackId)!} 
                 clipId={midiEditorOpen.clipId} 
                 bpm={state.bpm} 
                 currentTime={state.currentTime}
                 onUpdateTrack={handleUpdateTrack}
                 onClose={() => setMidiEditorOpen(null)}
             />
          </div>
      )}

      {isAudioSettingsOpen && <AudioSettingsPanel onClose={() => setIsAudioSettingsOpen(false)} />}
      
      <div className={isMobile && activeMobileTab !== 'NOVA' ? 'hidden' : ''}>
        <ChatAssistant onSendMessage={(msg) => getAIProductionAssistance(stateRef.current, msg)} onExecuteAction={() => {}} externalNotification={aiNotification} isMobile={isMobile} forceOpen={isMobile && activeMobileTab === 'NOVA'} onClose={() => setActiveMobileTab('PROJECT')} />
      </div>
      
      {isShareModalOpen && user && <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} onShare={() => {}} projectName={state.name} />}
      
      {isSaveMenuOpen && (
          <SaveProjectModal 
              isOpen={isSaveMenuOpen} 
              onClose={() => setIsSaveMenuOpen(false)} 
              currentName={state.name} 
              user={user} 
              onSaveCloud={handleSaveCloud}
              onSaveLocal={handleSaveLocal}
              onSaveAsCopy={handleSaveAsCopy}
              onOpenAuth={() => setIsAuthOpen(true)}
          />
      )}

      {isLoadMenuOpen && (
          <LoadProjectModal 
              isOpen={isLoadMenuOpen}
              onClose={() => setIsLoadMenuOpen(false)}
              user={user}
              onLoadCloud={handleLoadCloud}
              onLoadLocal={handleLoadLocalFile}
              onOpenAuth={() => setIsAuthOpen(true)}
          />
      )}

      {isExportMenuOpen && <ExportModal isOpen={isExportMenuOpen} onClose={() => setIsExportMenuOpen(false)} projectState={state} />}
    </div>
  );
}
