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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''; 
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const STORAGE_KEY = 'ministerio_infantil_data_v6';

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

    fetchCloudData();

    const channel = supabase
      .channel('public:domingos_data')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'domingos_data', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new && payload.new.data) {
            setAppState(payload.new.data);
            saveLocally(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveLocally = (dataToStore) => {
    try {
      const jsonValue = JSON.stringify(dataToStore);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, jsonValue);
        }
      } else {
        AsyncStorage.setItem(STORAGE_KEY, jsonValue).catch(() => {});
      }
    } catch (e) {
      console.log('Error local:', e);
    }
  };

  const fetchCloudData = async () => {
    try {
      let cachedData = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        cachedData = localStorage.getItem(STORAGE_KEY);
      } else {
        cachedData = await AsyncStorage.getItem(STORAGE_KEY);
      }
      if (cachedData) setAppState(JSON.parse(cachedData));

      const { data, error } = await supabase
        .from('domingos_data')
        .select('data')
        .eq('id', '1')
        .maybeSingle();

      if (!error && data && data.data) {
        setAppState(data.data);
        saveLocally(data.data);
        setNotification('✨ Sincronizado con la nube');
        setTimeout(() => setNotification(''), 2000);
      }
    } catch (err) {
      console.log('Error al consultar nube:', err);
    }
  };

  const updateCloudState = async (newState) => {
    setAppState(newState);
    saveLocally(newState);

    try {
      const { error } = await supabase
        .from('domingos_data')
        .upsert({ id: '1', data: newState, updated_at: new Date() }, { onConflict: 'id' });

      if (error) {
        console.error('Error Supabase:', error.message);
        setNotification('⚠️ Guardado local (Error en nube: ' + error.message + ')');
      } else {
        setNotification('💾 ¡Guardado y sincronizado en la nube!');
        setTimeout(() => setNotification(''), 2500);
      }
    } catch (error) {
      console.error('Excepción:', error);
      setNotification('⚠️ Guardado localmente');
    }
  };

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
    const currentSchedule = appState.schedule || {};
    const newSchedule = { ...currentSchedule, [key]: selectedName };
    const newState = { ...appState, schedule: newSchedule };
    
    updateCloudState(newState);
    setNotification(`🌟 ¡${selectedName} listo para servir!`);
  };

  const handleRemove = (sundayId, classId, roleName) => {
    const key = `${sundayId}_${classId}_${roleName}`;
    const currentSchedule = appState.schedule || {};
    const newSchedule = { ...currentSchedule };
    delete newSchedule[key];
    const newState = { ...appState, schedule: newSchedule };
    
    updateCloudState(newState);
  };

  const handleSaveTopic = (sundayId, classId) => {
    const key = `${sundayId}_${classId}`;
    const topicText = topicInputs[key];
    if (!topicText || topicText.trim() === '') return;

    const currentTopics = appState.topics || {};
    const newTopics = { ...currentTopics, [key]: topicText.trim() };
    const newState = { ...appState, topics: newTopics };
    
    updateCloudState(newState);
  };

  const handleRemoveTopic = (sundayId, classId) => {
    const key = `${sundayId}_${classId}`;
    const currentTopics = appState.topics || {};
    const newTopics = { ...currentTopics };
    delete newTopics[key];
    const newState = { ...appState, topics: newTopics };
    
    updateCloudState(newState);
  };

  const handleSaveResource = (sundayId, classId) => {
    const key = `${sundayId}_${classId}_res`;
    const resText = resourceInputs[key];
    if (!resText || resText.trim() === '') return;

    const currentResources = appState.resources || {};
    const newResources = { ...currentResources, [key]: resText.trim() };
    const newState = { ...appState, resources: newResources };
    
    updateCloudState(newState);
  };

  const handleRemoveResource = (sundayId, classId) => {
    const key = `${sundayId}_${classId}_res`;
    const currentResources = appState.resources || {};
    const newResources = { ...currentResources };
    delete newResources[key];
    const newState = { ...appState, resources: newResources };
    
    updateCloudState(newState);
  };

  const handleOpenLink = (url) => {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    Linking.openURL(formattedUrl).catch((err) => console.error('Error abriendo enlace:', err));
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
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>Ministerio Infantil</Text>
          
          <View style={styles.headerTopActions}>
            <View style={styles.themeSelector}>
              {Object.keys(THEMES).map(tKey => (
                <TouchableOpacity 
                  key={tKey} 
                  style={[styles.themeBtn, currentThemeKey === tKey && styles.themeBtnActive]}
                  onPress={() => setCurrentThemeKey(tKey)}
                >
                  <Text style={styles.themeBtnText}>{THEMES[tKey].name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.syncBtn} onPress={fetchCloudData}>
              <Text style={styles.syncBtnText}>🔄 Sincronizar</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.headerSubtitle, { color: theme.headerSub }]}>Programación Autónoma de Maestros</Text>
          
          {adminMode ? (
            <TouchableOpacity 
              style={[styles.adminBtn, { backgroundColor: '#ef4444' }]} 
              onPress={() => {
                setAdminMode(false);
                setNotification('🔒 Modo Coordinador cerrado.');
                setTimeout(() => setNotification(''), 3000);
              }}
            >
              <Text style={styles.adminBtnTextActive}>🔓 Coordinador Activo (Cerrar)</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.adminBtn, { backgroundColor: theme.btnBg }]} 
              onPress={() => {
                setPasswordInput('');
                setPasswordError('');
                setShowPasswordModal(true);
              }}
            >
              <Text style={[styles.adminBtnText, { color: theme.btnText }]}>🔑 Modo Coordinador</Text>
            </TouchableOpacity>
          )}
        </View>

        {showPasswordModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalEmoji}>🔒</Text>
              <Text style={styles.modalTitle}>¡Área de Coordinación!</Text>
              <Text style={styles.modalSubtitle}>Ingresa la clave secreta (1234):</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Contraseña..."
                placeholderTextColor="#94a3b8"
                secureTextEntry={true}
                value={passwordInput}
                onChangeText={setPasswordInput}
              />

              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]} 
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtn, styles.acceptBtn]} 
                  onPress={verifyPassword}
                >
                  <Text style={styles.acceptBtnText}>Entrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {notification ? (
          <View style={styles.notification}>
            <Text style={styles.notificationText}>{notification}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>📅 Selecciona por Mes y Domingo:</Text>

          <View style={styles.accordionContainer}>
            {Object.keys(groupedSundays).map(monthName => {
              const isOpen = openMonths[monthName];
              const sundaysList = groupedSundays[monthName];

              return (
                <View key={monthName} style={[styles.monthGroup, { borderColor: theme.tabSelectedBg }]}>
                  <TouchableOpacity 
                    style={[styles.monthHeader, { backgroundColor: theme.tabBg }]}
                    onPress={() => toggleMonthAccordion(monthName)}
                  >
                    <Text style={[styles.monthHeaderText, { color: theme.tabText }]}>
                      📂 {monthName.toUpperCase()} {isOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.monthSundaysList}>
                      {sundaysList.map(sun => {
                        const isSelected = selectedSunday === sun.id;
                        const statusEmoji = getSundayStatusEmoji(sun.id);

                        return (
                          <TouchableOpacity
                            key={sun.id}
                            style={[
                              styles.sundayOptionBtn,
                              { 
                                backgroundColor: isSelected ? theme.tabSelectedBg : theme.cardInner, 
                                borderColor: theme.tabSelectedBg 
                              }
                            ]}
                            onPress={() => handleSelectSunday(sun)}
                          >
                            <Text style={[styles.sundayOptionText, { color: isSelected ? theme.tabSelectedText : theme.textPrimary }]}>
                              ✨ {sun.fullDate}
                            </Text>
                            <Text style={styles.statusEmojiBadge}>{statusEmoji}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {selectedSunday && (
            <View style={styles.classesContainer}>
              <View style={[styles.cultoBoxTitle, { backgroundColor: theme.tabBg, borderColor: theme.tabSelectedBg }]}>
                <Text style={[styles.cultoTitleText, { color: theme.textPrimary }]}>
                  📖 Culto: {selectedSundayFullObj?.fullDate} {getSundayStatusEmoji(selectedSunday)}
                </Text>
              </View>

              {CLASSES_CONFIG.map((cls, index) => {
                const topicKey = `${selectedSunday}_${cls.id}`;
                const currentTopic = appState.topics ? appState.topics[topicKey] : undefined;
                const currentTopicInput = topicInputs[topicKey] || '';

                const resKey = `${selectedSunday}_${cls.id}_res`;
                const currentResource = appState.resources ? appState.resources[resKey] : undefined;
                const currentResourceInput = resourceInputs[resKey] || '';

                const cardBgColor = theme.cardBg[index % theme.cardBg.length];
                const cardBorderColor = theme.cardBorder[index % theme.cardBorder.length];

                return (
                  <View 
                    key={cls.id} 
                    style={[styles.classBox, { backgroundColor: cardBgColor, borderColor: cardBorderColor }]}
                  >
                    <Text style={[styles.className, { color: cardBorderColor }]}>{cls.name}</Text>
                    
                    <View style={[styles.topicSection, { backgroundColor: theme.cardInner }]}>
                      <Text style={[styles.topicLabel, { color: theme.textSecondary }]}>📖 TEMA / LECCIÓN:</Text>
                      {currentTopic ? (
                        <View style={[styles.assignedTopicBox, { backgroundColor: theme.bgApp }]}>
                          <Text style={[styles.assignedTopicText, { color: theme.textPrimary }]}>🎯 "{currentTopic}"</Text>
                          {adminMode && (
                            <TouchableOpacity onPress={() => handleRemoveTopic(selectedSunday, cls.id)}>
                              <Text style={styles.removeText}>Editar</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <View style={styles.inputRow}>
                          <TextInput
                            style={[styles.input, { backgroundColor: theme.bgApp, color: theme.textPrimary }]}
                            placeholder="Ej: Historia de Noé..."
                            placeholderTextColor="#94a3b8"
                            value={currentTopicInput}
                            onChangeText={(text) => setTopicInputs({ ...topicInputs, [topicKey]: text })}
                          />
                          <TouchableOpacity 
                            style={styles.topicSaveBtn}
                            onPress={() => handleSaveTopic(selectedSunday, cls.id)}
                          >
                            <Text style={styles.registerBtnText}>Guardar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <View style={[styles.topicSection, { backgroundColor: theme.cardInner }]}>
                      <Text style={[styles.topicLabel, { color: theme.textSecondary }]}>📎 ENLACE DE MATERIAL / AUDIO:</Text>
                      {currentResource ? (
                        <View style={[styles.assignedTopicBox, { backgroundColor: theme.bgApp }]}>
                          <TouchableOpacity 
                            style={{ flex: 1, marginRight: 8 }} 
                            onPress={() => handleOpenLink(currentResource)}
                          >
                            <Text style={[styles.assignedTopicText, { color: '#2563eb', textDecorationLine: 'underline' }]} numberOfLines={1}>
                              🔗 {currentResource} (Abrir enlace)
                            </Text>
                          </TouchableOpacity>
                          {adminMode && (
                            <TouchableOpacity onPress={() => handleRemoveResource(selectedSunday, cls.id)}>
                              <Text style={styles.removeText}>Cambiar</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <View style={styles.inputRow}>
                          <TextInput
                            style={[styles.input, { backgroundColor: theme.bgApp, color: theme.textPrimary }]}
                            placeholder="Pega enlace de Drive o audio..."
                            placeholderTextColor="#94a3b8"
                            value={currentResourceInput}
                            onChangeText={(text) => setResourceInputs({ ...resourceInputs, [resKey]: text })}
                          />
                          <TouchableOpacity 
                            style={[styles.topicSaveBtn, { backgroundColor: '#10b981' }]}
                            onPress={() => handleSaveResource(selectedSunday, cls.id)}
                          >
                            <Text style={styles.registerBtnText}>Adjuntar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {cls.roles.map(roleName => {
                      const key = `${selectedSunday}_${cls.id}_${roleName}`;
                      const assigned = appState.schedule ? appState.schedule[key] : undefined;
                      const options = roleName === 'Maestro Principal' 
                        ? ['Maestro 1', 'Maestro 2', 'Maestro 3'] 
                        : ['Auxiliar 1', 'Auxiliar 2', 'Auxiliar 3'];

                      return (
                        <View key={roleName} style={[styles.roleContainer, { backgroundColor: theme.cardInner }]}>
                          <Text style={[styles.roleTitle, { color: theme.textSecondary }]}>👤 {roleName}</Text>
                          
                          {assigned ? (
                            <View style={styles.assignedBox}>
                              <Text style={styles.assignedText}>🎉 ¡{assigned}!</Text>
                              {adminMode && (
                                <TouchableOpacity onPress={() => handleRemove(selectedSunday, cls.id, roleName)}>
                                  <Text style={styles.removeText}>Cambiar</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : (
                            <View style={styles.optionsRow}>
                              {options.map(optionName => (
                                <TouchableOpacity
                                  key={optionName}
                                  style={[styles.optionButton, { backgroundColor: theme.bgApp, borderColor: cardBorderColor }]}
                                  onPress={() => handleSelectTeacher(selectedSunday, cls.id, roleName, optionName)}
                                >
                                  <Text style={[styles.optionButtonText, { color: theme.textPrimary }]}>👉 {optionName}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    alignItems: 'center',
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 600,
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  themeBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  themeBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  themeBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  syncBtn: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  adminBtn: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    elevation: 2,
  },
  adminBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  adminBtnTextActive: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 6,
  },
  modalEmoji: { fontSize: 32, marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, textAlign: 'center' },
  modalInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    color: '#0f172a',
    textAlign: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
  acceptBtn: { backgroundColor: '#f59e0b' },
  acceptBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  notification: {
    backgroundColor: '#10b981',
    padding: 8,
    alignItems: 'center',
  },
  notificationText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  accordionContainer: { gap: 10, marginBottom: 16 },
  monthGroup: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  monthHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthHeaderText: {
    fontWeight: '800',
    fontSize: 14,
  },
  monthSundaysList: {
    padding: 8,
    gap: 6,
  },
  sundayOptionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sundayOptionText: {
    fontWeight: 'bold',
    fontSize: 12,
    flex: 1,
  },
  statusEmojiBadge: {
    fontSize: 16,
    marginLeft: 8,
  },
  classesContainer: { gap: 14 },
  cultoBoxTitle: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  cultoTitleTest: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  classBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    elevation: 2,
  },
  className: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  topicSection: { marginBottom: 10, padding: 10, borderRadius: 10 },
  topicLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  assignedTopicBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  assignedTopicText: { fontWeight: '700', fontSize: 13, flex: 1 },
  topicSaveBtn: { backgroundColor: '#3b82f6', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6 },
  roleContainer: { marginBottom: 8, padding: 10, borderRadius: 10 },
  roleTitle: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  assignedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  assignedText: {color: '#065f46', fontWeight: '700', fontSize: 12 },
  removeText: { color: '#dc2626', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionButton: { borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  optionButtonText: { fontSize: 11, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 6 },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  registerBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
});