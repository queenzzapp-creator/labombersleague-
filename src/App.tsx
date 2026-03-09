import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Trophy, 
  Timer, 
  User as UserIcon, 
  ChevronRight, 
  Play, 
  Square, 
  History, 
  ShieldAlert, 
  Activity, 
  Settings, 
  Folder, 
  FolderPlus, 
  ChevronDown, 
  Edit2,
  Youtube,
  FileText,
  Upload,
  ExternalLink,
  Image as ImageIcon,
  Download,
  TrendingUp,
  X,
  LogIn,
  LogOut
} from 'lucide-react';
import { Challenge, Result, User, Category, ChallengeFile } from './types';
import { cn, formatTime } from './lib/utils';
import { 
  db, 
  auth, 
  storage, 
  loginWithGoogle, 
  logout, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Cookie',
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<Result[]>([]);
  const [generalLeaderboard, setGeneralLeaderboard] = useState<any[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [isTiming, setIsTiming] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
  const [challengeFormData, setChallengeFormData] = useState({ 
    title: '', 
    description: '', 
    categoryId: '', 
    imageUrl: '', 
    youtubeUrl: '', 
    scoringType: 'TIME_ASC' as 'TIME_ASC' | 'TIME_DESC' | 'COUNT_DESC'
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [finalTime, setFinalTime] = useState<number>(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyChallenge, setHistoryChallenge] = useState<Challenge | null>(null);
  const [tempScore, setTempScore] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const userPB = useMemo(() => {
    if (!user || !activeChallenge) return null;
    const userResults = leaderboard.filter(r => r.userId === user.id && r.challengeId === activeChallenge.id);
    if (userResults.length === 0) return null;
    
    if (activeChallenge.scoringType === 'COUNT_DESC') {
      return Math.max(...userResults.map(r => r.score || 0));
    } else if (activeChallenge.scoringType === 'TIME_DESC') {
      return Math.max(...userResults.map(r => r.timeMs));
    } else {
      return Math.min(...userResults.map(r => r.timeMs));
    }
  }, [user, activeChallenge, leaderboard]);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Fetch or create user profile in Firestore
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), limit(1))); // Just a test
          // In a real app, we'd fetch the specific user doc
          const docRef = doc(db, 'users', fUser.uid);
          onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as User;
              setUser({ ...userData, id: fUser.uid });
              localStorage.setItem('bombero_user', JSON.stringify({ ...userData, id: fUser.uid }));
            } else {
              // If no profile yet, we'll show the name input
              setShowNameInput(true);
            }
          });
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUser(null);
        localStorage.removeItem('bombero_user');
      }
      setIsAuthReady(true);
    });

    // Categories listener
    const unsubscribeCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      
      // Expand all by default if first load
      setExpandedCategories(prev => {
        if (Object.keys(prev).length === 0) {
          const initial: Record<string, boolean> = {};
          cats.forEach(c => initial[c.id] = true);
          return initial;
        }
        return prev;
      });
    });

    // Challenges listener
    const unsubscribeChallenges = onSnapshot(collection(db, 'challenges'), (snapshot) => {
      const chals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
      // For each challenge, we need to fetch its files subcollection
      // This is a bit complex with onSnapshot for each, so we'll just fetch them for now
      // or better, we can structure files as an array inside the challenge doc if they are small
      setChallenges(chals);
    });

    // Results listener
    const unsubscribeResults = onSnapshot(query(collection(db, 'results'), orderBy('timestamp', 'desc'), limit(1000)), (snapshot) => {
      const res = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data, 
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : data.timestamp 
        } as unknown as Result;
      });
      setLeaderboard(res);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCategories();
      unsubscribeChallenges();
      unsubscribeResults();
      document.body.style.overflow = 'unset';
    };
  }, []);

  // General Leaderboard calculation (client-side for now to keep it simple and real-time)
  useEffect(() => {
    if (challenges.length === 0 || leaderboard.length === 0) return;

    const userPoints: Record<string, { userId: string, userName: string, userAvatar: string, points: number }> = {};
    
    for (const challenge of challenges) {
      const results = leaderboard.filter(r => r.challengeId === challenge.id);
      
      // Sort results based on scoring type
      const sortedResults = [...results].sort((a, b) => {
        if (challenge.scoringType === 'COUNT_DESC') {
          if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
          return a.timeMs - b.timeMs;
        }
        if (challenge.scoringType === 'TIME_DESC') return b.timeMs - a.timeMs;
        return a.timeMs - b.timeMs;
      });

      // Get best result per user for this challenge
      const bestResults: any[] = [];
      const seenUsers = new Set();
      for (const r of sortedResults) {
        if (!seenUsers.has(r.userId)) {
          bestResults.push(r);
          seenUsers.add(r.userId);
        }
      }
      
      bestResults.forEach((r, index) => {
        const points = Math.max(0, 1000 - (index * 25));
        if (!userPoints[r.userId]) {
          userPoints[r.userId] = {
            userId: r.userId,
            userName: r.userName,
            userAvatar: r.userAvatar || '',
            points: 0
          };
        }
        userPoints[r.userId].points += points;
      });
    }
    
    const sortedLeaderboard = Object.values(userPoints).sort((a, b) => b.points - a.points);
    setGeneralLeaderboard(sortedLeaderboard);
  }, [challenges, leaderboard]);

  useEffect(() => {
    if (showNameInput || showChallengeForm || showCategoryForm || showScoreModal || showHistoryModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showNameInput, showChallengeForm, showCategoryForm, showScoreModal, showHistoryModal]);

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || firebaseUser?.email === 'queenzz.app@gmail.com';
  }, [user, firebaseUser]);

  const playBeep = async (frequency: number, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio context not supported or blocked', e);
    }
  };

  const handleStartTimer = () => {
    if (!activeChallenge) return;
    
    setCountdown(3);
    playBeep(440, 0.1);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setCountdown(null);
          playBeep(880, 0.3);
          
          setIsTiming(true);
          setCurrentTime(0);
          startTimeRef.current = Date.now();
          timerRef.current = window.setInterval(() => {
            setCurrentTime(Date.now() - startTimeRef.current);
          }, 10);
          return null;
        }
        playBeep(440, 0.1);
        return prev - 1;
      });
    }, 1000);
  };

  const handleStopTimer = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stoppedTime = Date.now() - startTimeRef.current;
    setCurrentTime(stoppedTime);
    setFinalTime(stoppedTime);
    setIsTiming(false);
    
    if (user && activeChallenge) {
      if (activeChallenge.scoringType === 'COUNT_DESC') {
        setTempScore('');
        setShowScoreModal(true);
      } else {
        await handleSaveResult(stoppedTime);
      }
    }
  };

  const handleSaveResult = async (time: number, score?: number) => {
    if (!user || !activeChallenge) return;

    const resultData = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl || '',
      challengeId: activeChallenge.id,
      challengeTitle: activeChallenge.title,
      timeMs: time,
      score: score || 0,
      timestamp: Timestamp.now()
    };

    try {
      await addDoc(collection(db, 'results'), resultData);
      setShowScoreModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'results');
    }
  };

  const handleSaveName = async () => {
    if (tempName.trim() && firebaseUser) {
      const userId = firebaseUser.uid;
      let avatarUrl = tempAvatar;

      try {
        if (profilePhotoFile) {
          const storageRef = ref(storage, `avatars/${userId}-${Date.now()}`);
          const snapshot = await uploadBytes(storageRef, profilePhotoFile);
          avatarUrl = await getDownloadURL(snapshot.ref);
        }

        const userData = {
          name: tempName.trim(),
          avatarUrl: avatarUrl
        };

        await setDoc(doc(db, 'users', userId), userData, { merge: true });
        
        setShowNameInput(false);
        setProfilePhotoFile(null);
        setIsCreatingNew(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      }
    } else if (!firebaseUser) {
      try {
        await loginWithGoogle();
      } catch (err) {
        console.error('Login failed:', err);
      }
    }
  };

  const handleSelectUser = (selectedUser: User) => {
    setUser(selectedUser);
    localStorage.setItem('bombero_user', JSON.stringify(selectedUser));
    setShowNameInput(false);
    setIsCreatingNew(false);
  };

  const openProfileModal = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
    
    if (user) {
      setTempName(user.name);
      setTempAvatar(user.avatarUrl || AVATAR_OPTIONS[0]);
    } else {
      setTempName('');
      setTempAvatar(AVATAR_OPTIONS[0]);
      setIsCreatingNew(true);
    }
    setShowNameInput(true);
  };

  const resetChallengeForm = () => {
    setShowChallengeForm(false);
    setEditingChallenge(null);
    setChallengeFormData({ title: '', description: '', categoryId: '', imageUrl: '', youtubeUrl: '', scoringType: 'TIME_ASC' });
    setSelectedFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveChallenge = async () => {
    if (!challengeFormData.title.trim() || !challengeFormData.description.trim() || !challengeFormData.categoryId) {
      alert('Por favor, completa el título, la descripción y selecciona una categoría.');
      return;
    }

    try {
      let challengeId = editingChallenge?.id;
      const data = { ...challengeFormData };

      if (editingChallenge) {
        await updateDoc(doc(db, 'challenges', editingChallenge.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'challenges'), data);
        challengeId = docRef.id;
      }

      // Handle file uploads if any
      if (selectedFiles && selectedFiles.length > 0 && challengeId) {
        const filesData: ChallengeFile[] = editingChallenge?.files || [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const storageRef = ref(storage, `challenges/${challengeId}/${Date.now()}-${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          
          filesData.push({
            id: Math.random().toString(36).substr(2, 9),
            challengeId,
            filename: file.name,
            originalName: file.name,
            mimeType: file.type,
            downloadUrl
          });
        }
        await updateDoc(doc(db, 'challenges', challengeId), { files: filesData });
      }

      resetChallengeForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'challenges');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) return;

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), categoryFormData);
      } else {
        await addDoc(collection(db, 'categories'), categoryFormData);
      }
      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryFormData({ name: '', description: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'categories');
    }
  };

  const openEditChallenge = (e: React.MouseEvent, challenge: Challenge) => {
    e.stopPropagation();
    setEditingChallenge(challenge);
    setChallengeFormData({
      title: challenge.title,
      description: challenge.description,
      categoryId: challenge.categoryId,
      imageUrl: challenge.imageUrl || '',
      youtubeUrl: challenge.youtubeUrl || '',
      scoringType: challenge.scoringType || 'TIME_ASC'
    });
    setSelectedFiles(null);
    setShowChallengeForm(true);
  };

  const openEditCategory = (e: React.MouseEvent, category: Category) => {
    e.stopPropagation();
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || ''
    });
    setShowCategoryForm(true);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveChallenge(null)}>
            <div className="w-10 h-10 rounded-lg fire-gradient flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
              <Flame className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">LA BOMBERS <span className="text-red-500">LEAGUE</span></h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Elite Training Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={openProfileModal}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">{user?.name || 'Completar Perfil'}</span>
                </button>
                <button 
                  onClick={logout}
                  className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20"
              >
                <LogIn className="w-4 h-4" />
                Entrar con Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Challenges */}
        <div className="lg:col-span-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Maniobras Disponibles
              </h2>
              <div className="flex gap-2">
                {firebaseUser && (
                  <>
                    <button 
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormData({ name: '', description: '' });
                        setShowCategoryForm(true);
                      }}
                      title="Nueva Categoría"
                      className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (categories.length === 0) {
                          alert('Primero debes crear una categoría (carpeta) para poder añadir un reto.');
                          return;
                        }
                        setEditingChallenge(null);
                        setChallengeFormData({ title: '', description: '', categoryId: categories[0]?.id || '', imageUrl: '', youtubeUrl: '', scoringType: 'TIME_ASC' });
                        setSelectedFiles(null);
                        setShowChallengeForm(true);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded border border-zinc-700 transition-colors"
                    >
                      + Nuevo Reto
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div 
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", !expandedCategories[category.id] && "-rotate-90")} />
                      <Folder className="w-4 h-4 text-red-500/70" />
                      <span className="text-sm font-bold text-zinc-300 uppercase tracking-tight">{category.name}</span>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={(e) => openEditCategory(e, category)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                      >
                        <Edit2 className="w-3 h-3 text-zinc-500" />
                      </button>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {expandedCategories[category.id] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-2 pl-4 border-l border-zinc-800 ml-4"
                      >
                        {challenges.filter(c => c.categoryId === category.id).map((challenge) => (
                          <motion.div
                            key={challenge.id}
                            whileHover={{ x: 4 }}
                            onClick={() => {
                              setActiveChallenge(challenge);
                              setCurrentTime(0);
                              setIsTiming(false);
                            }}
                            className={cn(
                              "w-full text-left p-3 rounded-xl border transition-all duration-200 group relative cursor-pointer",
                              activeChallenge?.id === challenge.id 
                                ? "bg-red-500/10 border-red-500/50 ring-1 ring-red-500/20" 
                                : "glass-card hover:border-zinc-600"
                            )}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex-1">
                                <h3 className={cn(
                                  "font-bold text-sm leading-tight mb-1",
                                  activeChallenge?.id === challenge.id ? "text-red-500" : "text-white"
                                )}>
                                  {challenge.title}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <button 
                                    onClick={(e) => openEditChallenge(e, challenge)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                                  >
                                    <Settings className="w-3 h-3 text-zinc-400" />
                                  </button>
                                )}
                                <ChevronRight className={cn(
                                  "w-4 h-4 transition-transform",
                                  activeChallenge?.id === challenge.id ? "text-red-500 translate-x-1" : "text-zinc-600"
                                )} />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        {challenges.filter(c => c.categoryId === category.id).length === 0 && (
                          <p className="text-[10px] text-zinc-600 italic py-2">Sin maniobras en esta carpeta.</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Center Column: Active Challenge & Timer or General Leaderboard */}
        <div className="lg:col-span-5 space-y-6">
          <AnimatePresence mode="wait">
            {activeChallenge ? (
              <motion.div
                key={activeChallenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Activity className="w-32 h-32" />
                </div>

                <div className="mb-6 w-full space-y-6">
                  {/* YouTube Video */}
                  {activeChallenge.youtubeUrl && getYoutubeEmbedUrl(activeChallenge.youtubeUrl) && (
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                      <iframe
                        width="100%"
                        height="100%"
                        src={getYoutubeEmbedUrl(activeChallenge.youtubeUrl)!}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  {/* Main Image */}
                  {activeChallenge.imageUrl && (
                    <div className="w-full h-64 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
                      <img 
                        src={activeChallenge.imageUrl} 
                        alt={activeChallenge.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Uploaded Files */}
                  {activeChallenge.files && activeChallenge.files.length > 0 && (
                    <div className="space-y-4">
                      {/* Image Previews */}
                      {activeChallenge.files.filter(f => f.mimeType.startsWith('image/')).length > 0 && (
                        <div className="grid grid-cols-1 gap-4">
                          {activeChallenge.files.filter(f => f.mimeType.startsWith('image/')).map((file) => (
                            <div key={file.id} className="w-full rounded-xl overflow-hidden border border-zinc-800 shadow-lg group relative">
                              <img 
                                src={file.downloadUrl || `/uploads/${file.filename}`} 
                                alt={file.originalName} 
                                className="w-full h-auto object-contain max-h-[400px] bg-zinc-900"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a 
                                  href={file.downloadUrl || `/uploads/${file.filename}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-2 bg-black/50 backdrop-blur-md rounded-lg hover:bg-black/70 transition-colors block"
                                >
                                  <ExternalLink className="w-4 h-4 text-white" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Other Files (PDFs, etc) */}
                      {activeChallenge.files.filter(f => !f.mimeType.startsWith('image/')).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {activeChallenge.files.filter(f => !f.mimeType.startsWith('image/')).map((file) => (
                            <div key={file.id} className="glass-card p-3 rounded-xl flex items-center gap-3 group hover:border-zinc-600 transition-all">
                              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{file.originalName}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">{file.mimeType.split('/')[1]}</p>
                              </div>
                              <a 
                                href={file.downloadUrl || `/uploads/${file.filename}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                              >
                                <ExternalLink className="w-4 h-4 text-zinc-400" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-center mb-8">
                    {/* Scoring Type Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 mb-4">
                      <Activity className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {activeChallenge.scoringType === 'TIME_ASC' ? 'Menor Tiempo Gana' :
                         activeChallenge.scoringType === 'TIME_DESC' ? 'Mayor Tiempo Gana' :
                         'Mayor Repeticiones Gana'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 uppercase italic tracking-tighter leading-none">
                      {activeChallenge.title}
                    </h2>
                    <div className="glass-card p-6 rounded-2xl border-red-500/10 bg-red-500/5">
                      <p className="text-zinc-300 text-base leading-relaxed whitespace-pre-wrap">
                        {activeChallenge.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-10 font-mono relative h-32 flex items-center justify-center w-full">
                  <AnimatePresence mode="wait">
                    {countdown !== null ? (
                      <motion.div
                        key="countdown"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.2, opacity: 1 }}
                        exit={{ scale: 2, opacity: 0 }}
                        className="text-9xl font-black text-red-500 italic"
                      >
                        {countdown}
                      </motion.div>
                    ) : isTiming ? (
                      <motion.div
                        key="timer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center"
                      >
                        <div className="text-7xl font-bold tabular-nums tracking-tighter text-white mb-2">
                          {formatTime(currentTime)}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">
                          Minutos : Segundos : Centésimas
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="flex gap-4 w-full max-w-xs">
                  {!isTiming && countdown === null ? (
                    <button
                      onClick={handleStartTimer}
                      className="flex-1 fire-gradient hover:brightness-110 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-red-500/40 transition-all active:scale-95 text-lg"
                    >
                      <Play className="w-6 h-6 fill-current" />
                      INICIAR RETO
                    </button>
                  ) : isTiming ? (
                    <button
                      onClick={handleStopTimer}
                      className="flex-1 bg-white hover:bg-zinc-200 text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-lg"
                    >
                      <Square className="w-6 h-6 fill-current" />
                      DETENER
                    </button>
                  ) : (
                    <div className="flex-1 bg-zinc-800/50 text-zinc-500 font-bold py-5 rounded-2xl flex items-center justify-center gap-3 border border-zinc-700/50">
                      PREPARADOS...
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-2xl flex flex-col min-h-[600px]"
              >
                <div className="p-8 border-b border-zinc-800 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-3xl bg-yellow-500/10 flex items-center justify-center mb-4 border border-yellow-500/20">
                    <Trophy className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight">Clasificación General</h2>
                  <p className="text-zinc-500 mt-2 max-w-md">Puntuación total acumulada de todas las maniobras completadas.</p>
                </div>
                
                <div className="flex-1 p-6">
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {generalLeaderboard.map((entry, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={entry.userId} 
                        className={cn(
                          "flex items-center gap-6 p-5 rounded-2xl border transition-all",
                          entry.userId === user?.id 
                            ? "bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/5" 
                            : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black font-mono shadow-inner",
                          i === 0 ? "bg-yellow-500 text-black" : 
                          i === 1 ? "bg-zinc-300 text-black" : 
                          i === 2 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-500"
                        )}>
                          {i + 1}
                        </div>
                        
                        {entry.userAvatar ? (
                          <img 
                            src={entry.userAvatar} 
                            alt={entry.userName} 
                            className="w-14 h-14 rounded-2xl bg-zinc-800 border-2 border-zinc-700 object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                            <UserIcon className="w-6 h-6 text-zinc-600" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <p className="text-xl font-bold text-white flex items-center gap-2">
                            {entry.userName}
                            {user && entry.userId === user.id && (
                              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Tú</span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Bombero de Élite</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-3xl font-black text-red-500 font-mono leading-none">{entry.points}</p>
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Puntos Totales</p>
                        </div>
                      </motion.div>
                    ))}
                    {generalLeaderboard.length === 0 && (
                      <div className="py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
                          <Trophy className="w-8 h-8 text-zinc-800" />
                        </div>
                        <p className="text-zinc-500 italic">No hay registros en la clasificación general todavía.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="lg:col-span-3 space-y-6">
          <section className="glass-card rounded-2xl flex flex-col h-full max-h-[calc(100vh-12rem)]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                {activeChallenge ? (
                  <>
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    Clasificación Reto
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4 text-red-500" />
                    Mis Marcas Personales
                  </>
                )}
              </h2>
            </div>

            {user && activeChallenge && (
              <div className="p-4 border-b border-zinc-800 bg-red-500/5">
                <div 
                  onClick={() => {
                    setHistoryChallenge(activeChallenge);
                    setShowHistoryModal(true);
                  }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 relative overflow-hidden group cursor-pointer hover:bg-red-500/20 transition-all"
                >
                  <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-16 h-16 text-red-500" />
                  </div>
                  <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1">
                    {activeChallenge.customScoringName || 'Tu Mejor Marca'} (Ver Historial)
                  </p>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-mono font-black text-red-500">
                        {userPB ? (
                          activeChallenge.scoringType === 'COUNT_DESC' 
                            ? `${userPB} REPS` 
                            : formatTime(userPB)
                        ) : '--:--.--'}
                      </p>
                      {userPB && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          #{(() => {
                            const sorted = leaderboard
                              .filter(r => r.challengeId === activeChallenge.id)
                              .sort((a, b) => {
                                if (activeChallenge.scoringType === 'COUNT_DESC') {
                                  if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                                  return a.timeMs - b.timeMs;
                                }
                                if (activeChallenge.scoringType === 'TIME_DESC') return b.timeMs - a.timeMs;
                                return a.timeMs - b.timeMs;
                              });
                            const bests: any[] = [];
                            const seen = new Set();
                            for (const r of sorted) {
                              if (!seen.has(r.userId)) {
                                bests.push(r);
                                seen.add(r.userId);
                              }
                            }
                            return bests.findIndex(r => r.userId === user.id) + 1;
                          })()} Global
                        </span>
                      )}
                    </div>
                    {userPB && (
                      <div className="text-right">
                        <p className="text-lg font-mono font-black text-white">
                          {(() => {
                            const sorted = leaderboard
                              .filter(r => r.challengeId === activeChallenge.id)
                              .sort((a, b) => {
                                if (activeChallenge.scoringType === 'COUNT_DESC') {
                                  if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                                  return a.timeMs - b.timeMs;
                                }
                                if (activeChallenge.scoringType === 'TIME_DESC') return b.timeMs - a.timeMs;
                                return a.timeMs - b.timeMs;
                              });
                            const bests: any[] = [];
                            const seen = new Set();
                            for (const r of sorted) {
                              if (!seen.has(r.userId)) {
                                bests.push(r);
                                seen.add(r.userId);
                              }
                            }
                            const rank = bests.findIndex(r => r.userId === user.id);
                            return Math.max(0, 1000 - (rank * 25));
                          })()}
                        </p>
                        <p className="text-[8px] font-mono uppercase text-zinc-500 tracking-widest">Puntos</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activeChallenge ? (
                (() => {
                  const sorted = leaderboard
                    .filter(r => r.challengeId === activeChallenge.id)
                    .sort((a, b) => {
                      if (activeChallenge.scoringType === 'COUNT_DESC') {
                        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                        return a.timeMs - b.timeMs;
                      }
                      if (activeChallenge.scoringType === 'TIME_DESC') return b.timeMs - a.timeMs;
                      return a.timeMs - b.timeMs;
                    });
                  const bests: any[] = [];
                  const seen = new Set();
                  for (const r of sorted) {
                    if (!seen.has(r.userId)) {
                      bests.push(r);
                      seen.add(r.userId);
                    }
                  }
                  return bests;
                })().map((result, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      result.userId === user?.id ? "bg-red-500/5 border border-red-500/20" : "hover:bg-zinc-800/50"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono",
                      i === 0 ? "bg-yellow-500 text-black" : 
                      i === 1 ? "bg-zinc-300 text-black" : 
                      i === 2 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {i + 1}
                    </div>
                    {result.userAvatar && (
                      <img 
                        src={result.userAvatar} 
                        alt={result.userName} 
                        className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-white truncate">
                            {result.userName}
                            {user && result.userId === user.id && <span className="ml-1 text-[8px] text-red-500 opacity-60">(Tú)</span>}
                          </p>
                          <p className="text-[10px] font-mono font-black text-red-500/80">
                            {Math.max(0, 1000 - (i * 25))} PTS
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-zinc-400 font-bold">
                            {activeChallenge.scoringType === 'COUNT_DESC' ? `${result.score} REPS` : formatTime(result.timeMs)}
                          </p>
                          <div className="flex flex-col items-end">
                            {activeChallenge.scoringType === 'COUNT_DESC' && (
                              <p className="text-[8px] font-mono text-zinc-600">{formatTime(result.timeMs)}</p>
                            )}
                            <p className="text-[7px] text-zinc-700 font-mono uppercase">
                              {new Date(result.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                user && challenges.map(challenge => {
                  const challengeResults = leaderboard
                    .filter(r => r.challengeId === challenge.id)
                    .sort((a, b) => {
                      if (challenge.scoringType === 'COUNT_DESC') {
                        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                        return a.timeMs - b.timeMs;
                      }
                      if (challenge.scoringType === 'TIME_DESC') return b.timeMs - a.timeMs;
                      return a.timeMs - b.timeMs;
                    });

                  const bests: any[] = [];
                  const seen = new Set();
                  for (const r of challengeResults) {
                    if (!seen.has(r.userId)) {
                      bests.push(r);
                      seen.add(r.userId);
                    }
                  }

                  const userBest = bests.find(r => r.userId === user.id);
                  if (!userBest) return null;

                  const rank = bests.findIndex(r => r.userId === user.id) + 1;

                  return (
                    <div 
                      key={challenge.id} 
                      onClick={() => {
                        setHistoryChallenge(challenge);
                        setShowHistoryModal(true);
                      }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-red-500/50 transition-colors">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <div className="flex flex-col">
                            <p className="text-xs font-bold text-white truncate uppercase tracking-tight">
                              {challenge.title}
                            </p>
                            <p className="text-[10px] font-mono font-black text-red-500/80">
                              {Math.max(0, 1000 - ((rank - 1) * 25))} PTS
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono text-zinc-400 font-bold">
                              {challenge.scoringType === 'COUNT_DESC' ? `${userBest.score} REPS` : formatTime(userBest.timeMs)}
                            </p>
                            <div className="flex flex-col items-end">
                              <p className="text-[8px] text-zinc-600 font-mono uppercase">Pos: #{rank}</p>
                              <p className="text-[7px] text-zinc-700 font-mono uppercase">
                                {new Date(userBest.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {(activeChallenge ? leaderboard.filter(r => r.challengeId === activeChallenge.id) : (user ? challenges.filter(c => leaderboard.some(r => r.challengeId === c.id && r.userId === user.id)) : [])).length === 0 && (
                <div className="p-8 text-center text-zinc-600 text-sm italic">
                  No hay registros todavía.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Category Form Modal */}
      <AnimatePresence>
        {showCategoryForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                  <FolderPlus className="text-red-500 w-6 h-6" />
                </div>
                {editingCategory ? 'Editar Carpeta' : 'Nueva Carpeta'}
              </h2>
              
              <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Nombre de la Carpeta</label>
                  <input 
                    type="text" 
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Rescate de Altura"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Descripción (Opcional)</label>
                  <input 
                    type="text" 
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Breve descripción del grupo de maniobras..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowCategoryForm(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={handleSaveCategory}
                    className="flex-1 fire-gradient text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                  >
                    {editingCategory ? 'GUARDAR' : 'CREAR CARPETA'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Challenge Form Modal */}
      <AnimatePresence>
        {showChallengeForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg fire-gradient flex items-center justify-center">
                  <Flame className="text-white w-6 h-6" />
                </div>
                {editingChallenge ? 'Editar Maniobra' : 'Nueva Maniobra'}
              </h2>
              
              <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Título del Reto</label>
                  <input 
                    type="text" 
                    value={challengeFormData.title}
                    onChange={(e) => setChallengeFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej: Ascenso con manguera 45mm"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Categoría (Carpeta)</label>
                  <select 
                    value={challengeFormData.categoryId}
                    onChange={(e) => setChallengeFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all appearance-none"
                  >
                    <option value="" disabled>Selecciona una carpeta...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Tipo de Clasificación</label>
                  <select 
                    value={challengeFormData.scoringType}
                    onChange={(e) => setChallengeFormData(prev => ({ ...prev, scoringType: e.target.value as any }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all appearance-none"
                  >
                    <option value="TIME_ASC">Menor Tiempo Gana (Ej: Circuito)</option>
                    <option value="TIME_DESC">Mayor Tiempo Gana (Ej: Consumo Aire)</option>
                    <option value="COUNT_DESC">Mayor Repeticiones Gana (Ej: Dominadas)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">URL de la Imagen (Circuito)</label>
                    <input 
                      type="text" 
                      value={challengeFormData.imageUrl}
                      onChange={(e) => setChallengeFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://ejemplo.com/circuito.jpg"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Enlace YouTube (Opcional)</label>
                    <input 
                      type="text" 
                      value={challengeFormData.youtubeUrl}
                      onChange={(e) => setChallengeFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Adjuntar Archivos (Imágenes, PDFs...)</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      multiple
                      ref={fileInputRef}
                      onChange={(e) => setSelectedFiles(e.target.files)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-xl px-4 py-6 text-center group-hover:border-red-500/50 transition-all">
                      <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2 group-hover:text-red-500 transition-colors" />
                      <p className="text-sm text-zinc-400">
                        {selectedFiles ? `${selectedFiles.length} archivos seleccionados` : 'Haz clic o arrastra archivos aquí'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Descripción Detallada (Reglas)</label>
                  <textarea 
                    rows={4}
                    value={challengeFormData.description}
                    onChange={(e) => setChallengeFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe los pasos exactos para que el reto sea justo para todos..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={resetChallengeForm}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={handleSaveChallenge}
                    className="flex-1 fire-gradient text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                  >
                    {editingChallenge ? 'GUARDAR CAMBIOS' : 'PUBLICAR RETO'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showNameInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-red-500" />
                  {isCreatingNew ? 'Nuevo Bombero' : (user ? 'Mi Perfil' : 'Identificarse')}
                </h2>
                <div className="flex gap-2">
                  {!isCreatingNew && (
                    <button 
                      onClick={() => {
                        setIsCreatingNew(true);
                        setTempName('');
                        setTempAvatar(AVATAR_OPTIONS[0]);
                        setProfilePhotoFile(null);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-500 px-2 py-1 rounded border border-red-500/20 transition-colors"
                    >
                      + Nuevo
                    </button>
                  )}
                  {isCreatingNew && allUsers.length > 0 && (
                    <button 
                      onClick={() => setIsCreatingNew(false)}
                      className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1 rounded border border-zinc-700 transition-colors"
                    >
                      Volver
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                {isCreatingNew || (user && !allUsers.some(u => u.id === user.id)) ? (
                  <div className="space-y-6">
                    <div className="w-24 h-24 rounded-2xl fire-gradient flex items-center justify-center mx-auto shadow-xl shadow-red-500/20 relative group overflow-hidden">
                      <img 
                        src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : tempAvatar} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-xl bg-zinc-900/50 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => profilePhotoInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Upload className="w-6 h-6 text-white" />
                      </button>
                      <input 
                        type="file"
                        ref={profilePhotoInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setProfilePhotoFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-3 block text-center">Selecciona tu Avatar</label>
                      <div className="grid grid-cols-4 gap-3">
                        {AVATAR_OPTIONS.map((avatar, idx) => (
                          <button
                            key={idx}
                            onClick={() => setTempAvatar(avatar)}
                            className={cn(
                              "relative rounded-xl overflow-hidden border-2 transition-all p-1",
                              tempAvatar === avatar ? "border-red-500 bg-red-500/10 scale-110 z-10" : "border-zinc-800 hover:border-zinc-600 bg-zinc-800/50"
                            )}
                          >
                            <img src={avatar} alt={`Avatar ${idx}`} className="w-full h-auto rounded-lg" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1.5 block">Nombre / Unidad</label>
                      <input 
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="Ej: Oficial Pérez / B-12"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-center font-bold"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                      />
                    </div>

                    <button 
                      onClick={handleSaveName}
                      disabled={!tempName.trim()}
                      className="w-full fire-gradient text-white font-bold py-4 rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      {isCreatingNew ? 'CREAR PERFIL' : 'GUARDAR CAMBIOS'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Buscar bombero..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                      />
                      <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-2">Bomberos Registrados</p>
                      <div className="grid grid-cols-1 gap-2">
                        {allUsers
                          .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()))
                          .map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleSelectUser(u)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                user?.id === u.id 
                                  ? "bg-red-500/10 border-red-500/50 ring-1 ring-red-500/20" 
                                  : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
                              )}
                            >
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-zinc-700" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                                  <UserIcon className="w-5 h-5 text-zinc-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{u.name}</p>
                                {user?.id === u.id && <p className="text-[10px] text-red-500 font-mono uppercase">Sesión Activa</p>}
                              </div>
                              <ChevronRight className={cn(
                                "w-4 h-4 transition-transform",
                                user?.id === u.id ? "text-red-500 translate-x-1" : "text-zinc-600 group-hover:text-zinc-400"
                              )} />
                            </button>
                          ))}
                        {allUsers.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-zinc-500 text-sm italic">No hay bomberos registrados.</p>
                            <button 
                              onClick={() => setIsCreatingNew(true)}
                              className="text-red-500 text-sm font-bold mt-2 hover:underline"
                            >
                              Crear el primero
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {user && (
                  <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
                    {!isCreatingNew && (
                      <button 
                        onClick={() => {
                          setTempName(user.name);
                          setTempAvatar(user.avatarUrl || AVATAR_OPTIONS[0]);
                          setIsCreatingNew(true);
                        }}
                        className="w-full text-zinc-400 text-xs hover:text-white transition-colors py-2 flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-3 h-3" />
                        Editar mi perfil actual
                      </button>
                    )}
                    <button 
                      onClick={() => setShowNameInput(false)}
                      className="w-full text-zinc-500 text-xs hover:text-zinc-300 transition-colors py-2"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Chart Modal */}
      <AnimatePresence>
        {showHistoryModal && historyChallenge && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <History className="text-red-500 w-6 h-6" />
                  </div>
                  Historial de Progreso
                </h2>
                <p className="text-zinc-500 mt-1 font-mono text-xs uppercase tracking-widest">{historyChallenge.title}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-xl text-center">
                  <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1">Mejor Marca</p>
                  <p className="text-xl font-black text-white font-mono">
                    {(() => {
                      const results = leaderboard.filter(r => r.challengeId === historyChallenge.id && r.userId === user.id);
                      if (historyChallenge.scoringType === 'COUNT_DESC') {
                        return `${Math.max(...results.map(r => r.score || 0))} REPS`;
                      }
                      const bestTime = Math.min(...results.map(r => r.timeMs));
                      return formatTime(bestTime);
                    })()}
                  </p>
                </div>
                <div className="glass-card p-4 rounded-xl text-center">
                  <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1">Total Intentos</p>
                  <p className="text-xl font-black text-white font-mono">
                    {leaderboard.filter(r => r.challengeId === historyChallenge.id && r.userId === user.id).length}
                  </p>
                </div>
                <div className="glass-card p-4 rounded-xl text-center">
                  <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-1">Último</p>
                  <p className="text-xl font-black text-red-500 font-mono">
                    {(() => {
                      const results = leaderboard
                        .filter(r => r.challengeId === historyChallenge.id && r.userId === user.id)
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                      const last = results[0];
                      if (!last) return '-';
                      return historyChallenge.scoringType === 'COUNT_DESC' ? `${last.score} REPS` : formatTime(last.timeMs);
                    })()}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest mb-3">Historial Detallado</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {leaderboard
                    .filter(r => r.challengeId === historyChallenge.id && r.userId === user.id)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((r, idx) => (
                      <div key={r.id || idx} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group hover:border-red-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                            {idx + 1}
                          </div>
                          <span className="text-xs text-zinc-400 font-mono">
                            {new Date(r.timestamp).toLocaleDateString('es-ES', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-white font-mono">
                          {historyChallenge.scoringType === 'COUNT_DESC' ? `${r.score} REPS` : formatTime(r.timeMs)}
                        </span>
                      </div>
                    ))
                    .reverse()
                  }
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Servidor Activo</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">v1.0.2-stable</span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            © 2024 Firefighter Training Systems • Seguridad ante todo
          </p>
        </div>
      </footer>

      {/* Score Input Modal */}
      <AnimatePresence>
        {showScoreModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-card rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-red-500/30 max-h-[90vh] flex flex-col"
            >
              <div className="overflow-y-auto pr-2 custom-scrollbar">
                <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl fire-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
                  <Activity className="text-white w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Resultado Final</h2>
                <p className="text-zinc-500 text-sm mt-1">Introduce el número de repeticiones</p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="number" 
                    autoFocus
                    value={tempScore}
                    onChange={(e) => setTempScore(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-4 py-6 text-5xl font-black text-center text-red-500 focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-800"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black uppercase tracking-widest text-xs pointer-events-none">
                    {activeChallenge?.customScoringName || 'REPS'}
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest">Tiempo Total</span>
                  <span className="text-lg font-mono font-bold text-white">{formatTime(finalTime)}</span>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowScoreModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
                  >
                    DESCARTAR
                  </button>
                  <button 
                    onClick={() => handleSaveResult(finalTime, parseFloat(tempScore))}
                    disabled={!tempScore}
                    className="flex-[2] fire-gradient text-white font-bold py-4 rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    GUARDAR MARCA
                  </button>
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
