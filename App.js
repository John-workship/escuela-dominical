import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView,
  Platform,
  StatusBar,
  useWindowDimensions,
  Linking
} from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -------------------------------------------------------------------
// 1. CONFIGURACIÓN SUPABASE & ALMACENAMIENTO HÍBRIDO (WEB / MÓVIL)
// -------------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''; 
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const customStorage = {
  getItem: (key) => {
    if (Platform.OS === 'web') {
      return Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// -------------------------------------------------------------------
// 2. CONSTANTES Y CONFIGURACIÓN DE LA APP
// -------------------------------------------------------------------
const getSundaysGroupedByMonths = () => {
  const monthsMap = {};
  let date = new Date();
  date.setDate(date.getDate() + ((0 + 7 - date.getDay()) % 7));
  
  const currentMonthIndex = date.getMonth();
  const targetMonthLimit = (currentMonthIndex + 2) % 12;

  while (true) {
    const d = new Date(date);
    const monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    if (!monthsMap[formattedMonth]) {
      monthsMap[formattedMonth] = [];
    }

    monthsMap[formattedMonth].push({
      id: d.toISOString().split('T')[0],
      shortDate: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      fullDate: d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    });

    date.setDate(date.getDate() + 7);

    const totalSundays = Object.values(monthsMap).reduce((acc, curr) => acc + curr.length, 0);
    if (totalSundays >= 10 || (d.getMonth() !== currentMonthIndex && d.getMonth() === targetMonthLimit && d.getDate() > 20)) {
      break;
    }
  }

  return monthsMap;
};

const THEMES = {
  infantil: {
    name: '🎨 Infantil',
    bgApp: '#fffbeb',
    headerBg: '#fbbf24',
    headerText: '#78350f',
    headerSub: '#92400e',
    cardBg: ['#fef3c7', '#e0f2fe', '#dcfce7', '#fae8ff'],
    cardBorder: ['#f59e0b', '#0284c7', '#16a34a', '#c084fc'],
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    cardInner: 'rgba(255, 255, 255, 0.7)',
    btnBg: '#ffffff',
    btnText: '#1e293b',
    tabBg: '#ffffff',
    tabText: '#78350f',
    tabSelectedBg: '#f59e0b',
    tabSelectedText: '#ffffff',
  },
  dark: {
    name: '🌙 Oscuro',
    bgApp: '#0f172a',
    headerBg: '#1e293b',
    headerText: '#f8fafc',
    headerSub: '#94a3b8',
    cardBg: ['#1e293b', '#1e293b', '#1e293b', '#1e293b'],
    cardBorder: ['#38bdf8', '#38bdf8', '#38bdf8', '#38bdf8'],
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    cardInner: 'rgba(15, 23, 42, 0.6)',
    btnBg: '#334155',
    btnText: '#f8fafc',
    tabBg: '#1e293b',
    tabText: '#94a3b8',
    tabSelectedBg: '#38bdf8',
    tabSelectedText: '#0f172a',
  },
  light: {
    name: '☀️ Claro',
    bgApp: '#f1f5f9',
    headerBg: '#2563eb',
    headerText: '#ffffff',
    headerSub: '#93c5fd',
    cardBg: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
    cardBorder: ['#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1'],
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    cardInner: '#f8fafc',
    btnBg: '#ffffff',
    btnText: '#1e293b',
    tabBg: '#ffffff',
    tabText: '#334155',
    tabSelectedBg: '#2563eb',
    tabSelectedText: '#ffffff',
  }
};

const CLASSES_CONFIG = [
  { id: 'cuna', name: '👶 Cuna / Bebés (0-2 años)', roles: ['Maestro Principal', 'Auxiliar'] },
  { id: 'parvulos', name: '🎨 Párvulos (3-5 años)', roles: ['Maestro Principal', 'Auxiliar'] },
  { id: 'primarios', name: '📖 Primarios (6-9 años)', roles: ['Maestro Principal', 'Auxiliar'] },
  { id: 'preteens', name: '🔥 Pre-Adolescentes (10-12 años)', roles: ['Maestro Principal', 'Auxiliar'] }
];

const ADMIN_PASSWORD = '1234';

export default function App() {
  const { width } = useWindowDimensions();
  const [groupedSundays, setGroupedSundays] = useState({});
  const [selectedSunday, setSelectedSunday] = useState('');
  const [selectedSundayFullObj, setSelectedSundayFullObj] = useState(null);
  const [openMonths, setOpenMonths] = useState({});

  const [appState, setAppState] = useState({ schedule: {}, topics: {}, resources: {} });
  
  const [topicInputs, setTopicInputs] = useState({});
  const [resourceInputs, setResourceInputs] = useState({});
  const [adminMode, setAdminMode] = useState(false);
  const [currentThemeKey, setCurrentThemeKey] = useState('infantil');
  const theme = THEMES[currentThemeKey];

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [notification, setNotification] = useState('');

  // -------------------------------------------------------------------
  // 3. SINCRONIZACIÓN Y CARGA DESDE SUPABASE (ID: '1')
  // -------------------------------------------------------------------
  useEffect(() => {
    const monthsData = getSundaysGroupedByMonths();
    setGroupedSundays(monthsData);

    const monthKeys = Object.keys(monthsData);
    if (monthKeys.length > 0) {
      setOpenMonths({ [monthKeys[0]]: true });
      if (monthsData[monthKeys[0]].length > 0) {
        const firstSun = monthsData[monthKeys[0]][0];
        setSelectedSunday(firstSun.id);
        setSelectedSundayFullObj(firstSun);
      }
    }

    fetchCloudState();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'domingos_data' },
        (payload) => {
          if (payload.new && payload.new.data) {
            setAppState(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCloudState = async () => {
    try {
      const { data, error } = await supabase
        .from('domingos_data')
        .select('data')
        .eq('id', '1')
        .maybeSingle();

      if (data && data.data) {
        setAppState(data.data);
      }
    } catch (err) {
      console.log('Error al cargar estado de Supabase:', err);
    }
  };

  const updateCloudState = async (newState) => {
    setAppState(newState); 
    try {
      const { error } = await supabase
        .from('domingos_data')
        .upsert({ id: '1', data: newState, updated_at: new Date() });
      
      if (error) {
        console.error('Error al guardar en Supabase:', error.message);
      }
    } catch (error) {
      console.error('Excepción al sincronizar:', error);
    }
  };

  // -------------------------------------------------------------------
  // 4. MANEJADORES DE EVENTOS
  // -------------------------------------------------------------------
  const getSundayStatusEmoji = (sundayId) => {
    let totalSlots = 0;
    let filledSlots = 0;

    CLASSES_CONFIG.forEach(cls => {
      cls.roles.forEach(roleName => {
        totalSlots++;
        const key = `${sundayId}_${cls.id}_${roleName}`;
        if (appState.schedule && appState.schedule[key]) {
          filledSlots++;
        }
      });
    });

    if (filledSlots === 0) return '🙁';
    if (filledSlots === totalSlots) return '😊';
    return '😐';
  };

  const toggleMonthAccordion = (monthName) => {
    setOpenMonths(prev => ({ ...prev, [monthName]: !prev[monthName] }));
  };

  const handleSelectSunday = (sunObj) => {
    setSelectedSunday(sunObj.id);
    setSelectedSundayFullObj(sunObj);
  };

  const handleSelectTeacher = (sundayId, classId, roleName, selectedName) => {
    const key = `${sundayId}_${classId}_${roleName}`;
    const newSchedule = { ...appState.schedule, [key]: selectedName };
    const newState = { ...appState, schedule: newSchedule };
    
    updateCloudState(newState);
    setNotification(`🌟 ¡${selectedName} listo para servir!`);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleRemove = (sundayId, classId, roleName) => {
    const key = `${sundayId}_${classId}_${roleName}`;
    const newSchedule = { ...appState.schedule };
    delete newSchedule[key];
    
    updateCloudState({ ...appState, schedule: newSchedule });
  };

  const handleSaveTopic = (sundayId, classId) => {
    const key = `${sundayId}_${classId}`;
    const topicText = topicInputs[key];
    if (!topicText || topicText.trim() === '') return;

    const newTopics = { ...appState.topics, [key]: topicText.trim() };
    updateCloudState({ ...appState, topics: newTopics });
    
    setNotification('🎯 ¡Tema de clase guardado!');
    setTimeout(() => setNotification(''), 3000);
  };

  const handleRemoveTopic = (sundayId, classId) => {
    const key = `${sundayId}_${classId}`;
    const newTopics = { ...appState.topics };
    delete newTopics[key];
    
    updateCloudState({ ...appState, topics: newTopics });
  };

  const handleSaveResource = (sundayId, classId) => {
    const key = `${sundayId}_${classId}_res`;
    const resText = resourceInputs[key];
    if (!resText || resText.trim() === '') return;

    const newResources = { ...appState.resources, [key]: resText.trim() };
    updateCloudState({ ...appState, resources: newResources });
    
    setNotification('📎 ¡Enlace de material guardado!');
    setTimeout(() => setNotification(''), 3000);
  };

  const handleRemoveResource = (sundayId, classId) => {
    const key = `${sundayId}_${classId}_res`;
    const newResources = { ...appState.resources };
    delete newResources[key];
    
    updateCloudState({ ...appState, resources: newResources });
  };

  const handleOpenLink = (url) => {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    Linking.openURL(formattedUrl).catch((err) => console.error('No se pudo abrir el enlace:', err));
  };

  const verifyPassword = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAdminMode(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
      setNotification('🔓 ¡Modo Coordinador activado!');
      setTimeout(() => setNotification(''), 3000);
    } else {
      setPasswordError('Clave incorrecta. Prueba con 1234');
    }
  };

  const containerWebStyle = Platform.OS === 'web' ? {
    backgroundImage: currentThemeKey === 'infantil' 
      ? 'radial-gradient(#fde68a 1px, transparent 1px)' 
      : 'none',
    backgroundSize: '16px 16px'
  } : {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgApp }, containerWebStyle]}>
      <View style={styles.responsiveWrapper}>
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.headerTitle, { color: theme.headerText }]}>Escuela Dominical</Text>
            
            <View style={styles.themeSelector}>
              {Object.keys(THEMES).map(tKey => (
                <TouchableOpacity 
                  key={tKey} 
                  style={[styles.themeBtn, currentThemeKey === tKey && styles.themeBtnActive]}
                  onPress={() => setCurrentThemeKey(tKey)}
                >
                  <Text style={styles.themeBtnText}>{THEMES[tKey].name.split(' ')[0]}</Text>
                </TouchableOpacity>