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

// Credenciales directas integradas para garantizar conectividad total sin fallos de red
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    detectSessionInUrl: true,
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
  },
});

const STORAGE_KEY = 'ministerio_infantil_data_v10';

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
    bgApp: '#f5f7ff',
    headerBg: '#26345b',
    headerText: '#ffffff',
    headerSub: '#dbeafe',
    cardBg: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
    cardBorder: ['#e8b94f', '#72b8e8', '#70c9a4', '#b69ae8'],
    textPrimary: '#172554',
    textSecondary: '#53627f',
    cardInner: '#f8faff',
    btnBg: '#ffffff',
    btnText: '#26345b',
    tabBg: '#ffffff',
    tabText: '#26345b',
    tabSelectedBg: '#f0b94b',
    tabSelectedText: '#1f2a44',
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
  { id: 'cuna', name: '👶 Cuna / Bebés (0-2 años)', roles: ['Maestro(a)', 'Auxiliar'] },
  { id: 'parvulos', name: '🎨 Párvulos (3-5 años)', roles: ['Maestro Principal', 'Auxiliar'] },
  { id: 'primarios', name: '📖 Primarios (6-9 años)', roles: ['Maestro Principal', 'Auxiliar'] },
  { id: 'preteens', name: '🔥 Pre-Adolescentes (10-12 años)', roles: ['Maestro Principal', 'Auxiliar'] }
];

// El rol se consulta en el perfil protegido de Supabase.
const hasCoordinatorAccess = (role) => role === 'administrador' || role === 'responsable';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [profileRole, setProfileRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamForm, setTeamForm] = useState({ email: '', display_name: '', role: 'profesor', group_id: 'cuna' });
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [profileGroupId, setProfileGroupId] = useState(null);
  const [groupSettings, setGroupSettings] = useState({});
  const [groupNameDrafts, setGroupNameDrafts] = useState({});
  const [ministryRequests, setMinistryRequests] = useState([]);
  const [needDrafts, setNeedDrafts] = useState({});
  const [resourceDrafts, setResourceDrafts] = useState({});

  const loadUserRole = async (user) => {
    if (!user?.id) {
      setProfileRole(null);
      setProfileGroupId(null);
      setAdminMode(false);
      return null;
    }
    const { data, error } = await supabase.from('ministerio_infantil_profiles').select('role,active,group_id').eq('id', user.id).maybeSingle();
    if (error || !data?.role || data.active === false) {
      console.warn('No se pudo verificar el rol del usuario:', error?.message);
      setProfileRole(null);
      setAdminMode(false);
      return null;
    }
    setProfileRole(data.role);
    setProfileGroupId(data.group_id || null);
    setAdminMode(hasCoordinatorAccess(data.role));
    return data.role;
  };

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

    let mounted = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn('No se pudo restaurar la sesión:', error.message);
      const user = data?.session?.user || null;
      setAuthUser(user);
      if (user) {
        const role = await loadUserRole(user);
        if (role) setCurrentView('app');
        else {
          await supabase.auth.signOut();
          setAuthUser(null);
          setCurrentView('landing');
        }
      } else {
        setProfileRole(null);
        setAdminMode(false);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setAuthUser(user);
      if (user) {
        Promise.resolve().then(() => loadUserRole(user));
      } else {
        setProfileRole(null);
        setAdminMode(false);
        setCurrentView('landing');
        setShowLoginModal(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setAppState({ schedule: {}, topics: {}, resources: {} });
      return undefined;
    }

    fetchCloudData();
    const channel = supabase
      .channel('authenticated:ministerio_infantil_data')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ministerio_infantil_data', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new && payload.new.data) {
            setAppState(payload.new.data);
            saveLocally(payload.new.data);
            setNotification('⚡ ¡Actualizado desde la nube!');
            setTimeout(() => setNotification(''), 2500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

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
    if (!authUser) {
      setNotification('🔒 Inicia sesión para consultar la programación.');
      return;
    }
    try {
      setNotification('🔄 Sincronizando con Supabase...');
      let cachedData = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        cachedData = localStorage.getItem(STORAGE_KEY);
      } else {
        cachedData = await AsyncStorage.getItem(STORAGE_KEY);
      }
      if (cachedData) setAppState(JSON.parse(cachedData));

      const { data, error } = await supabase
        .from('ministerio_infantil_data')
        .select('data')
        .eq('id', '1')
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        setNotification('⚠️ Modo local activo');
      } else if (data && data.data) {
        setAppState(data.data);
        saveLocally(data.data);
        setNotification('✨ ¡Sincronizado con éxito!');
      }
      setTimeout(() => setNotification(''), 2500);
    } catch (err) {
      console.log('Error de red:', err);
      setNotification('⚠️ Sin conexión');
      setTimeout(() => setNotification(''), 2500);
    }
  };

  const updateCloudState = async (newState) => {
    if (!authUser || !hasCoordinatorAccess(profileRole)) {
      setNotification('🔒 Solo administración principal o responsable autorizado puede modificar la programación.');
      return false;
    }
    try {
      const { error } = await supabase
        .from('ministerio_infantil_data')
        .upsert({ id: '1', data: newState, updated_at: new Date() }, { onConflict: 'id' });

      if (error) {
        console.error('Error Supabase upsert:', error.message);
        setNotification('⚠️ Error al guardar en nube: ' + error.message);
      } else {
        setAppState(newState);
        saveLocally(newState);
        setNotification('💾 ¡Guardado y sincronizado en la nube!');
        setTimeout(() => setNotification(''), 2500);
        return true;
      }
    } catch (error) {
      console.error('Excepción:', error.message);
      setNotification('⚠️ No se pudo guardar en la nube. No se confirmaron los cambios.');
      setTimeout(() => setNotification(''), 3500);
    }
    return false;
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

  const loadMinistryExtras = async () => {
    if (!authUser) return;
    const [{ data: groups }, { data: requests }] = await Promise.all([
      supabase.from('ministerio_infantil_groups').select('id,display_name,age_range').order('id'),
      supabase.from('ministerio_infantil_requests').select('*').eq('service_date', selectedSunday || '1900-01-01').order('created_at', { ascending: false }),
    ]);
    if (groups) {
      setGroupSettings(Object.fromEntries(groups.map(g => [g.id, g])));
      setGroupNameDrafts(Object.fromEntries(groups.map(g => [g.id, g.display_name])));
    }
    if (requests) setMinistryRequests(requests);
  };

  const saveGroupNames = async () => {
    if (!hasCoordinatorAccess(profileRole)) return;
    const updates = Object.entries(groupNameDrafts).map(([id, display_name]) => ({
      id, display_name: String(display_name || '').trim()
    }));
    if (updates.some(g => !g.display_name || g.display_name.length > 70)) {
      setTeamError('Cada grupo debe tener un nombre de 1 a 70 caracteres.'); return;
    }
    setTeamSaving(true); setTeamError('');
    for (const group of updates) {
      const { error } = await supabase.from('ministerio_infantil_groups').update({
        display_name: group.display_name, updated_at: new Date().toISOString(), updated_by: authUser.id
      }).eq('id', group.id);
      if (error) { setTeamError('No se pudieron guardar los nombres: ' + error.message); setTeamSaving(false); return; }
    }
    await loadMinistryExtras();
    setNotification('Nombres de grupos actualizados.');
    setTeamSaving(false);
  };

  const createMinistryRequest = async (kind, groupId, content = '') => {
    if (!authUser || !selectedSunday) return;
    const clean = String(content || '').trim();
    if (['necesidad','recurso'].includes(kind) && !clean) {
      setNotification(kind === 'necesidad' ? 'Escribe qué necesitas para la clase.' : 'Pega el enlace del material o audio.');
      return;
    }
    if (kind === 'necesidad') {
      const existingNeed = ministryRequests.find(r => r.kind === 'necesidad' && r.group_id === groupId && r.user_id === authUser.id);
      if (existingNeed) {
        const { error } = await supabase.from('ministerio_infantil_requests').update({
          content: clean, updated_at: new Date().toISOString()
        }).eq('id', existingNeed.id);
        if (error) { setNotification('No se pudo actualizar la necesidad: ' + error.message); return; }
      } else {
        const { error } = await supabase.from('ministerio_infantil_requests').insert({
          kind, service_date: selectedSunday, group_id: groupId, user_id: authUser.id, content: clean
        });
        if (error) { setNotification('No se pudo guardar la necesidad: ' + error.message); return; }
      }
    } else {
      const { error } = await supabase.from('ministerio_infantil_requests').insert({
        kind, service_date: selectedSunday, group_id: groupId, user_id: authUser.id, content: clean
      });
      if (error) {
        setNotification(error.code === '23505' ? 'Ya tienes una postulación registrada para este grupo y servicio.' : 'No se pudo guardar: ' + error.message);
        return;
      }
    }
    setNeedDrafts(p => ({ ...p, [groupId]: '' }));
    setResourceDrafts(p => ({ ...p, [groupId]: '' }));
    await loadMinistryExtras();
    setNotification(kind === 'postulacion' ? 'Postulación enviada al responsable.' : kind === 'necesidad' ? 'Necesidad enviada al responsable.' : 'Enlace compartido con el grupo.');
  };

  const updateMinistryRequest = async (requestId, changes) => {
    const { error } = await supabase.from('ministerio_infantil_requests').update({
      ...changes, updated_at: new Date().toISOString(), updated_by: authUser.id
    }).eq('id', requestId);
    if (error) { setNotification('No se pudo actualizar: ' + error.message); return; }
    await loadMinistryExtras();
  };

  const deleteMinistryRequest = async (requestId) => {
    const { error } = await supabase.from('ministerio_infantil_requests').delete().eq('id', requestId);
    if (error) { setNotification('No se pudo quitar el registro: ' + error.message); return; }
    await loadMinistryExtras();
  };

  const handleOpenLink = (url) => {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    Linking.openURL(formattedUrl).catch((err) => console.error('Error abriendo enlace:', err));
  };

  useEffect(() => {
    if (authUser && selectedSunday) loadMinistryExtras();
    if (authUser && hasCoordinatorAccess(profileRole)) loadTeamMembers();
  }, [authUser, selectedSunday, profileRole]);

  const callTeamAdmin = async (payload) => {
    const { data, error } = await supabase.functions.invoke('ministerio-infantil-admin', { body: payload });
    if (error) throw new Error(error.message || 'No se pudo completar la operación.');
    if (data && data.error) throw new Error(data.error);
    return data;
  };
  const loadTeamMembers = async () => {
    setTeamLoading(true); setTeamError('');
    try { const data = await callTeamAdmin({ action: 'list' }); setTeamMembers(data.members || []); }
    catch (error) { setTeamError(error.message || 'No se pudo cargar el equipo.'); }
    finally { setTeamLoading(false); }
  };
  const openTeamManager = async () => {
    setShowTeamModal(true);
    setEditingTeamMember(null);
    setTeamForm({ email: '', display_name: '', role: 'profesor', group_id: 'cuna' });
    await loadTeamMembers();
  };
  const editTeamMember = (member) => {
    if (member.role === 'administrador' || (member.role === 'responsable' && profileRole !== 'administrador')) return;
    setEditingTeamMember(member);
    setTeamError('');
    setTeamForm({ email: member.email || '', display_name: member.display_name || '', role: member.role || 'profesor', group_id: member.group_id || 'cuna' });
  };
  const cancelTeamEdit = () => {
    setEditingTeamMember(null);
    setTeamForm({ email: '', display_name: '', role: 'profesor', group_id: 'cuna' });
    setTeamError('');
  };
  const submitTeamMember = async () => {
    if (!teamForm.email.trim() || !teamForm.display_name.trim()) { setTeamError('Escribe el nombre y el correo.'); return; }
    setTeamSaving(true); setTeamError('');
    try {
      const result = await callTeamAdmin({ action: 'assign', email: teamForm.email, display_name: teamForm.display_name, role: teamForm.role, group_id: teamForm.role === 'responsable' ? null : teamForm.group_id });
      setNotification(result.message || (editingTeamMember ? 'Cambios guardados.' : 'Equipo actualizado.'));
      cancelTeamEdit();
      await loadTeamMembers();
      setTimeout(() => setNotification(''), 4000);
    } catch (error) { setTeamError(error.message || 'No se pudo guardar.'); }
    finally { setTeamSaving(false); }
  };
  const deactivateTeamMember = async (member) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('¿Desactivar la cuenta de ' + member.display_name + '?')) return;
    setTeamSaving(true); setTeamError('');
    try { const result = await callTeamAdmin({ action: 'deactivate', user_id: member.id }); setNotification(result.message || 'Cuenta desactivada.'); await loadTeamMembers(); }
    catch (error) { setTeamError(error.message || 'No se pudo desactivar.'); }
    finally { setTeamSaving(false); }
  };

  const verifyLoginAccess = async () => {
    const email = loginUser.trim().toLowerCase();
    if (!email || !loginPass) {
      setLoginError('Ingresa tu correo y contraseña.');
      return;
    }
    if (isSignUpMode) {
      const permittedEmails = ['jhobocal@hotmail.com', 'forever1178@hotmail.com'];
      if (!permittedEmails.includes(email)) {
        setLoginError('Este correo aún no está autorizado para Ministerio Infantil.');
        return;
      }
      setAuthLoading(true);
      setLoginError('');
      const { data, error } = await supabase.auth.signUp({
        email,
        password: loginPass,
        options: {
          emailRedirectTo: 'https://ministerio-infantil-git-mejora-ministerio-infantil-sound-team.vercel.app/',
        },
      });
      setAuthLoading(false);
      if (error) {
        setLoginError(error.message || 'No se pudo crear la cuenta.');
        return;
      }
      if (data?.session?.user) {
        setAuthUser(data.session.user);
        const role = await loadUserRole(data.session.user);
        if (!role) {
          await supabase.auth.signOut();
          setAuthUser(null);
          setLoginError('El correo no tiene autorización en Ministerio Infantil.');
          return;
        }
        setIsSignUpMode(false);
        setShowLoginModal(false);
        setCurrentView('app');
        return;
      }
      setIsSignUpMode(false);
      setLoginPass('');
      setLoginError('Cuenta creada. Revisa el correo para confirmar el acceso y luego inicia sesión.');
      return;
    }

    setAuthLoading(true);
    setLoginError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: loginPass });
    setAuthLoading(false);
    if (error || !data?.user) {
      setLoginError('No fue posible validar el acceso. Revisa tus credenciales.');
      return;
    }
    const role = await loadUserRole(data.user);
    if (!role) {
      await supabase.auth.signOut();
      setAuthUser(null);
      setLoginError('Este correo no está habilitado para Ministerio Infantil.');
      return;
    }
    setAuthUser(data.user);
    setAdminMode(hasCoordinatorAccess(role));
    setShowLoginModal(false);
    setLoginUser('');
    setLoginPass('');
    setCurrentView('app');
    setNotification(hasCoordinatorAccess(role) ? `🔐 Sesión de ${role === 'administrador' ? 'Administración principal' : 'Responsable del ministerio'} iniciada.` : 'Acceso de consulta activado.');
    setTimeout(() => setNotification(''), 3000);
  };

  const containerWebStyle = Platform.OS === 'web' ? {
    backgroundImage: currentThemeKey === 'infantil' || currentView === 'landing'
      ? 'radial-gradient(#dbeafe 1.2px, transparent 1.2px)' 
      : 'none',
    backgroundSize: '28px 28px'
  } : {};

  // VISTA 1: MENÚ DE INICIO (LANDING PAGE)
  if (currentView === 'landing') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#f5f7ff' }, containerWebStyle]}>
        <View style={styles.responsiveWrapper}>
          
          <View style={styles.landingHeader}>
            <Text style={{ fontSize: 24 }}>🎨</Text>
            <Text style={styles.landingBrand}>Ministerio Infantil</Text>
            <Text style={{ fontSize: 24 }}>🧸</Text>
          </View>

          <ScrollView contentContainerStyle={styles.landingScroll}>
            <View style={styles.heroBox}>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>🌟 ¡Bienvenidos Maestros y Amigos! 🌟</Text>
              </View>

              <Text style={styles.heroTitle}>
                Cultivando el futuro con <Text style={{ color: '#d97706', textDecorationLine: 'underline' }}>amor y fe</Text>
              </Text>

              <Text style={styles.heroSubtitle}>
                Portal oficial de coordinación. Organiza tus clases, diviértete enseñando y mantén todo sincronizado en tiempo real.
              </Text>

              <TouchableOpacity 
                style={styles.mainCtaBtn}
                onPress={() => {
                  if (authUser) {
                    setCurrentView('app');
                    return;
                  }
                  setLoginUser('');
                  setLoginPass('');
                  setLoginError('');
                  setShowLoginModal(true);
                }}
              >
                <Text style={styles.mainCtaText}>🚀 Entrar a la Programación</Text>
              </TouchableOpacity>
            </View>

            {/* ZONA INFANTIL CON MUÑECOS Y PERSONAJES */}
            <View style={styles.kidsBannerContainer}>
              <Text style={styles.kidsBannerTitle}>🧸 Nuestros Pequeños Campeones 🎈</Text>
              
              <View style={styles.dollsRow}>
                <View style={[styles.dollCard, { width: width >= 900 ? '23%' : '47%' }]}>
                  <Text style={styles.dollEmoji}>👶🍼</Text>
                  <Text style={styles.dollName}>Cuna</Text>
                  <Text style={styles.dollDesc}>Bebés llenos de amor</Text>
                </View>

                <View style={[styles.dollCard, { width: width >= 900 ? '23%' : '47%' }]}>
                  <Text style={styles.dollEmoji}>🎨🖍️</Text>
                  <Text style={styles.dollName}>Párvulos</Text>
                  <Text style={styles.dollDesc}>Arte y risas</Text>
                </View>

                <View style={[styles.dollCard, { width: width >= 900 ? '23%' : '47%' }]}>
                  <Text style={styles.dollEmoji}>📖✨</Text>
                  <Text style={styles.dollName}>Primarios</Text>
                  <Text style={styles.dollDesc}>Historias bíblicas</Text>
                </View>

                <View style={[styles.dollCard, { width: width >= 900 ? '23%' : '47%' }]}>
                  <Text style={styles.dollEmoji}>🔥🎸</Text>
                  <Text style={styles.dollName}>Pre-Teens</Text>
                  <Text style={styles.dollDesc}>Liderazgo y fe</Text>
                </View>
              </View>
            </View>

          </ScrollView>

          {/* MODAL DE INICIO DE SESIÓN DISCRETO (ID Y PASSWORD) */}
          {showLoginModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalEmoji}>🔐</Text>
                <Text style={styles.modalTitle}>{isSignUpMode ? 'Crear cuenta inicial' : 'Acceso a Programación'}</Text>
                <Text style={styles.modalSubtitle}>{isSignUpMode ? 'Registra una de las dos cuentas autorizadas:' : 'Ingresa con tu cuenta autorizada:'}</Text>
                
                <TextInput
                  style={styles.modalInput}
                  placeholder="Correo electrónico"
                  placeholderTextColor="#94a3b8"
                  value={loginUser}
                  onChangeText={setLoginUser}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                />

                <TextInput
                  style={styles.modalInput}
                  placeholder="Password..."
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={true}
                  value={loginPass}
                  onChangeText={setLoginPass}
                  autoComplete="current-password"
                  textContentType="password"
                />

                {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalBtn, styles.cancelBtn]} 
                    onPress={() => setShowLoginModal(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalBtn, styles.acceptBtn]} 
                    disabled={authLoading}
                    onPress={verifyLoginAccess}
                  >
                    <Text style={styles.acceptBtnText}>{authLoading ? 'Procesando…' : isSignUpMode ? 'Crear cuenta' : 'Ingresar'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => { setIsSignUpMode(!isSignUpMode); setLoginError(''); setLoginPass(''); }} style={{ marginTop: 14, alignSelf: 'center' }}>
                  <Text style={{ color: '#2563eb', fontWeight: '700' }}>{isSignUpMode ? 'Ya tengo cuenta · Iniciar sesión' : 'Primera vez · Crear cuenta inicial'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.landingFooter}>
            <Text style={styles.footerText}>© 2026 Ministerio Infantil — Con amor para los niños.</Text>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // VISTA 2: APLICACIÓN PRINCIPAL DE PROGRAMACIÓN
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgApp }, containerWebStyle]}>
      <View style={styles.responsiveWrapper}>
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
          
          <TouchableOpacity 
            style={styles.backToHomeBtn}
            onPress={() => setCurrentView('landing')}
          >
            <Text style={styles.backToHomeText}>🏠 Volver al Inicio</Text>
          </TouchableOpacity>

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

          <Text style={[styles.headerSubtitle, { color: theme.headerSub }]}>Programación del Ministerio Infantil · {adminMode ? 'Edición autorizada' : 'Solo lectura'}</Text>
          
          {authUser ? (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={[styles.adminBtnText, { color: theme.headerText }]}>
                {adminMode ? `🔐 ${profileRole === 'administrador' ? 'Administración principal' : 'Responsable del ministerio'} autorizado` : '👁️ Acceso de solo consulta'}
              </Text>
              {hasCoordinatorAccess(profileRole) && <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#2563eb' }]} onPress={openTeamManager}><Text style={styles.adminBtnTextActive}>👥 Gestionar equipo y grupos</Text></TouchableOpacity>}
              <TouchableOpacity
                style={[styles.adminBtn, { backgroundColor: '#dc2626' }]}
                onPress={async () => {
                  await supabase.auth.signOut();
                  setAuthUser(null);
                  setAdminMode(false);
                  setCurrentView('landing');
                }}
              >
                <Text style={styles.adminBtnTextActive}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>



        {notification ? (
          <View style={styles.notification}>
            <Text style={styles.notificationText}>{notification}</Text>
          </View>
        ) : null}

        {showTeamModal && (
          <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:2000,elevation:20,backgroundColor:'rgba(15,23,42,0.72)',padding:14,justifyContent:'center'}}>
            <ScrollView style={{width:'100%',maxWidth:760,maxHeight:'94%',alignSelf:'center',backgroundColor:'#fff',borderRadius:20,padding:18}} contentContainerStyle={{paddingBottom:20}}>
              <Text style={{fontSize:20,fontWeight:'900',color:'#172554',marginBottom:4}}>👥 Administración del equipo</Text>
              <Text style={{fontSize:12,color:'#64748b',marginBottom:14}}>{profileRole==='administrador'?'Puedes administrar cuentas, funciones, grupos y nombrar o reemplazar al responsable.':'Puedes administrar maestros, auxiliares y nombres de grupos. Solo administración principal puede cambiar al responsable.'}</Text>
              <Text style={{fontSize:14,fontWeight:'900',color:editingTeamMember?'#1d4ed8':'#1e293b',marginBottom:8}}>{editingTeamMember?'✏️ Editando persona registrada':'➕ Registrar una persona nueva'}</Text>
              <TextInput style={styles.modalInput} placeholder="Nombre completo" value={teamForm.display_name} onChangeText={v=>setTeamForm(p=>({...p,display_name:v}))}/>
              <TextInput style={[styles.modalInput, editingTeamMember && {backgroundColor:'#f1f5f9',color:'#64748b'}]} placeholder="Correo electrónico individual" value={teamForm.email} onChangeText={v=>setTeamForm(p=>({...p,email:v}))} autoCapitalize="none" keyboardType="email-address" editable={!editingTeamMember}/>
              <Text style={{fontSize:12,fontWeight:'800',color:'#475569',marginBottom:6}}>Función</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:10}}>
                {[{value:'profesor',label:'Maestro(a)'},{value:'auxiliar',label:'Auxiliar'},...(profileRole==='administrador'?[{value:'responsable',label:'Responsable'}]:[])].map(o=><TouchableOpacity key={o.value} onPress={()=>setTeamForm(p=>({...p,role:o.value}))} style={{padding:8,borderRadius:9,backgroundColor:teamForm.role===o.value?'#dbeafe':'#f1f5f9',borderWidth:1,borderColor:teamForm.role===o.value?'#2563eb':'#e2e8f0'}}><Text style={{color:teamForm.role===o.value?'#1d4ed8':'#475569',fontSize:12,fontWeight:'800'}}>{o.label}</Text></TouchableOpacity>)}
              </View>
              {teamForm.role!=='responsable'&&<><Text style={{fontSize:12,fontWeight:'800',color:'#475569',marginBottom:6}}>Grupo</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:10}}>{CLASSES_CONFIG.map(g=><TouchableOpacity key={g.id} onPress={()=>setTeamForm(p=>({...p,group_id:g.id}))} style={{padding:8,borderRadius:9,backgroundColor:teamForm.group_id===g.id?'#dcfce7':'#f1f5f9',borderWidth:1,borderColor:teamForm.group_id===g.id?'#16a34a':'#e2e8f0'}}><Text style={{fontSize:11,fontWeight:'800',color:'#334155'}}>{g.name}</Text></TouchableOpacity>)}</View></>}
              <TouchableOpacity disabled={teamSaving} onPress={submitTeamMember} style={{backgroundColor:'#2563eb',padding:12,borderRadius:10,alignItems:'center',marginBottom:editingTeamMember?7:12}}><Text style={{color:'#fff',fontWeight:'900'}}>{teamSaving?'Procesando…':editingTeamMember?'Guardar cambios':teamForm.role==='responsable'?'Nombrar / reemplazar responsable':'Enviar invitación y asignar permisos'}</Text></TouchableOpacity>
              {editingTeamMember&&<TouchableOpacity disabled={teamSaving} onPress={cancelTeamEdit} style={{backgroundColor:'#e2e8f0',padding:10,borderRadius:10,alignItems:'center',marginBottom:12}}><Text style={{color:'#334155',fontWeight:'800'}}>Cancelar edición</Text></TouchableOpacity>}
              {teamError?<Text style={{color:'#dc2626',fontSize:12,fontWeight:'700',marginBottom:10}}>{teamError}</Text>:null}
              <View style={{height:1,backgroundColor:'#e2e8f0',marginBottom:12}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}><Text style={{fontSize:14,fontWeight:'900',color:'#1e293b'}}>Personas registradas</Text><TouchableOpacity onPress={loadTeamMembers}><Text style={{color:'#2563eb',fontWeight:'800'}}>Actualizar</Text></TouchableOpacity></View>
              {teamLoading?<Text style={{color:'#64748b',padding:12}}>Cargando equipo…</Text>:teamMembers.map(m=><View key={m.id} style={{padding:11,borderRadius:12,backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',marginBottom:7}}><View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><View style={{flex:1}}><Text style={{fontWeight:'900',color:'#172554'}}>{m.display_name||m.email}</Text><Text style={{color:'#64748b',fontSize:11}}>{m.email}</Text><Text style={{color:'#475569',fontSize:11}}>{m.role==='administrador'?'Administración principal':m.role==='responsable'?'Responsable':m.role==='profesor'?'Maestro(a)':'Auxiliar'}{m.group_id?' · '+(groupSettings[m.group_id]?.display_name || m.group_id):''}{m.active?' · Activo':' · Desactivado'}</Text></View><View style={{flexDirection:'row',gap:6,alignItems:'center'}}>{m.role!=='administrador'&&(m.role!=='responsable'||profileRole==='administrador')?<TouchableOpacity disabled={teamSaving} onPress={()=>editTeamMember(m)} style={{padding:7,backgroundColor:'#dbeafe',borderRadius:8}}><Text style={{color:'#1d4ed8',fontWeight:'800',fontSize:10}}>Editar</Text></TouchableOpacity>:null}{m.active&&!['administrador','responsable'].includes(m.role)?<TouchableOpacity disabled={teamSaving} onPress={()=>deactivateTeamMember(m)} style={{padding:7,backgroundColor:'#fee2e2',borderRadius:8}}><Text style={{color:'#b91c1c',fontWeight:'800',fontSize:10}}>Desactivar</Text></TouchableOpacity>:null}</View></View></View>)}
              <View style={{height:1,backgroundColor:'#e2e8f0',marginVertical:14}}/>
              <Text style={{fontSize:15,fontWeight:'900',color:'#172554',marginBottom:5}}>🏷️ Nombres de los grupos</Text>
              <Text style={{fontSize:12,color:'#64748b',marginBottom:10}}>El responsable puede gestionar los nombres acordados con administración principal. Los rangos de edad se conservan.</Text>
              {CLASSES_CONFIG.map(g=><View key={g.id} style={{marginBottom:8}}>
                <Text style={{fontSize:11,fontWeight:'800',color:'#475569',marginBottom:3}}>{g.id.toUpperCase()} · {groupSettings[g.id]?.age_range || ''}</Text>
                <TextInput style={[styles.modalInput,{textAlign:'left',marginBottom:0}]} value={groupNameDrafts[g.id] || ''} onChangeText={v=>setGroupNameDrafts(p=>({...p,[g.id]:v}))} placeholder="Nombre del grupo"/>
              </View>)}
              <TouchableOpacity disabled={teamSaving} onPress={saveGroupNames} style={{backgroundColor:'#0f766e',padding:12,borderRadius:10,alignItems:'center',marginTop:10}}>
                <Text style={{color:'#fff',fontWeight:'900'}}>{teamSaving?'Guardando…':'Guardar nombres de grupos'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setShowTeamModal(false)} style={{padding:12,backgroundColor:'#e2e8f0',borderRadius:10,alignItems:'center',marginTop:8}}><Text style={{color:'#334155',fontWeight:'900'}}>Cerrar</Text></TouchableOpacity>
            </ScrollView>
          </View>
        )}

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
            <View style={[styles.classesContainer, width >= 900 && styles.classesGrid]}>
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
                    style={[styles.classBox, { backgroundColor: cardBgColor, borderColor: cardBorderColor, width: width >= 900 ? '48.5%' : '100%' }]}
                  >
                    <Text style={[styles.className, { color: cardBorderColor }]}>{groupSettings[cls.id]?.display_name || cls.name}</Text>
                    
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
                          {adminMode ? <TextInput
                            style={[styles.input, { backgroundColor: theme.bgApp, color: theme.textPrimary }]}
                            placeholder="Ej: Historia de Noé..."
                            placeholderTextColor="#94a3b8"
                            value={currentTopicInput}
                            onChangeText={(text) => setTopicInputs({ ...topicInputs, [topicKey]: text })}
                          /> : <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Pendiente de programación por coordinación.</Text>}
                          {adminMode && <TouchableOpacity 
                            style={styles.topicSaveBtn}
                            onPress={() => handleSaveTopic(selectedSunday, cls.id)}
                          >
                            <Text style={styles.registerBtnText}>Guardar</Text>
                          </TouchableOpacity>}
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
                          {adminMode ? <TextInput
                            style={[styles.input, { backgroundColor: theme.bgApp, color: theme.textPrimary }]}
                            placeholder="Pega enlace de Drive o audio..."
                            placeholderTextColor="#94a3b8"
                            value={currentResourceInput}
                            onChangeText={(text) => setResourceInputs({ ...resourceInputs, [resKey]: text })}
                          /> : <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Sin material adjunto.</Text>}
                          {adminMode && <TouchableOpacity 
                            style={[styles.topicSaveBtn, { backgroundColor: '#10b981' }]}
                            onPress={() => handleSaveResource(selectedSunday, cls.id)}
                          >
                            <Text style={styles.registerBtnText}>Adjuntar</Text>
                          </TouchableOpacity>}
                        </View>
                      )}
                    </View>

                    {(() => {
                      const myApplication = ministryRequests.find(r => r.kind === 'postulacion' && r.group_id === cls.id && r.user_id === authUser?.id);
                      const classNeeds = ministryRequests.filter(r => r.kind === 'necesidad' && r.group_id === cls.id);
                      const classResources = ministryRequests.filter(r => r.kind === 'recurso' && r.group_id === cls.id);
                      return (
                        <View style={{marginTop:8}}>
                          {(profileRole === 'profesor' || profileRole === 'auxiliar') && (
                            <View style={[styles.topicSection,{backgroundColor:theme.cardInner}]}>
                              <Text style={[styles.topicLabel,{color:theme.textSecondary}]}>🙋 POSTULARSE PARA APOYAR ESTE SERVICIO</Text>
                              <Text style={{fontSize:12,color:theme.textSecondary,marginBottom:7}}>{myApplication ? 'Tu postulación está registrada: '+myApplication.status : 'Puedes postularte para apoyar este grupo en esta fecha.'}</Text>
                              {!myApplication && <TouchableOpacity onPress={()=>createMinistryRequest('postulacion',cls.id)} style={{backgroundColor:'#2563eb',padding:10,borderRadius:8,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>Enviar postulación</Text></TouchableOpacity>}
                              {myApplication?.status==='pendiente' && <TouchableOpacity onPress={()=>deleteMinistryRequest(myApplication.id)} style={{padding:7,alignItems:'center'}}><Text style={styles.removeText}>Retirar postulación</Text></TouchableOpacity>}
                            </View>
                          )}
                          {profileRole === 'profesor' && profileGroupId === cls.id && (
                            <>
                              <View style={[styles.topicSection,{backgroundColor:theme.cardInner}]}>
                                <Text style={[styles.topicLabel,{color:theme.textSecondary}]}>📎 ENLACE DE MATERIAL / AUDIO · MAESTROS(AS)</Text>
                                {classResources.map(r=><View key={r.id} style={{padding:8,backgroundColor:theme.bgApp,borderRadius:8,marginBottom:5}}>
                                  <TouchableOpacity onPress={()=>handleOpenLink(r.content)}><Text style={{color:'#2563eb',textDecorationLine:'underline',fontSize:12}}>{r.content}</Text></TouchableOpacity>
                                  <Text style={{fontSize:10,color:theme.textSecondary}}>Compartido por {r.user_id===authUser?.id?'ti':'un maestro(a)'}</Text>
                                  {r.user_id===authUser?.id && <TouchableOpacity onPress={()=>deleteMinistryRequest(r.id)}><Text style={styles.removeText}>Quitar enlace</Text></TouchableOpacity>}
                                </View>)}
                                <TextInput style={[styles.modalInput,{textAlign:'left'}]} placeholder="Pega enlace de Drive, audio o material" value={resourceDrafts[cls.id]||''} onChangeText={v=>setResourceDrafts(p=>({...p,[cls.id]:v}))} autoCapitalize="none"/>
                                <TouchableOpacity onPress={()=>createMinistryRequest('recurso',cls.id,resourceDrafts[cls.id])} style={{backgroundColor:'#0f766e',padding:9,borderRadius:8,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>Compartir enlace</Text></TouchableOpacity>
                              </View>
                              <View style={[styles.topicSection,{backgroundColor:theme.cardInner}]}>
                                <Text style={[styles.topicLabel,{color:theme.textSecondary}]}>🧰 ¿QUÉ NECESITAS PARA DESARROLLAR LA CLASE?</Text>
                                <TextInput style={[styles.modalInput,{textAlign:'left',minHeight:70}]} multiline placeholder="Materiales, apoyo, recursos, impresiones, equipo…" value={needDrafts[cls.id] ?? (ministryRequests.find(r=>r.kind==='necesidad'&&r.group_id===cls.id&&r.user_id===authUser?.id)?.content || '')} onChangeText={v=>setNeedDrafts(p=>({...p,[cls.id]:v}))}/>
                                <TouchableOpacity onPress={()=>createMinistryRequest('necesidad',cls.id,needDrafts[cls.id] ?? ministryRequests.find(r=>r.kind==='necesidad'&&r.group_id===cls.id&&r.user_id===authUser?.id)?.content)} style={{backgroundColor:'#7c3aed',padding:9,borderRadius:8,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>Guardar / actualizar necesidad</Text></TouchableOpacity>
                              </View>
                            </>
                          )}
                          {hasCoordinatorAccess(profileRole) && (classNeeds.length>0 || classResources.length>0 || ministryRequests.some(r=>r.kind==='postulacion'&&r.group_id===cls.id)) && (
                            <View style={[styles.topicSection,{backgroundColor:'#eff6ff'}]}>
                              <Text style={{fontWeight:'900',color:'#1e3a8a',marginBottom:7}}>📬 Solicitudes y postulaciones · Coordinación</Text>
                              {ministryRequests.filter(r=>r.group_id===cls.id && r.kind==='postulacion').map(r=><View key={r.id} style={{padding:7,backgroundColor:'#fff',borderRadius:7,marginBottom:5}}>
                                <Text style={{fontSize:12,fontWeight:'800',color:'#1e293b'}}>Postulación · {teamMembers.find(m=>m.id===r.user_id)?.display_name || 'Integrante'} · {r.status}</Text>
                                {r.status==='pendiente' && <View style={{flexDirection:'row',gap:8,marginTop:5}}>
                                  <TouchableOpacity onPress={()=>updateMinistryRequest(r.id,{status:'aprobada'})}><Text style={{color:'#15803d',fontWeight:'800'}}>Aprobar</Text></TouchableOpacity>
                                  <TouchableOpacity onPress={()=>updateMinistryRequest(r.id,{status:'rechazada'})}><Text style={{color:'#dc2626',fontWeight:'800'}}>Rechazar</Text></TouchableOpacity>
                                </View>}
                              </View>)}
                              {classNeeds.map(r=><View key={r.id} style={{padding:8,backgroundColor:'#fff',borderRadius:7,marginBottom:5}}>
                                <Text style={{fontSize:12,fontWeight:'900',color:'#1e293b'}}>Necesidad · {teamMembers.find(m=>m.id===r.user_id)?.display_name || 'Maestro(a)'}</Text>
                                <Text style={{fontSize:12,color:'#334155'}}>{r.content}</Text>
                                <Text style={{fontSize:11,color:'#64748b'}}>Estado: {r.status}</Text>
                                <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:5}}>
                                  {['gestionando','resuelta'].map(st=><TouchableOpacity key={st} onPress={()=>updateMinistryRequest(r.id,{status:st})}><Text style={{color:'#2563eb',fontWeight:'800'}}>{st==='gestionando'?'Gestionando':'Marcar resuelta'}</Text></TouchableOpacity>)}
                                </View>
                              </View>)}
                              {classResources.map(r=><View key={r.id} style={{padding:7,backgroundColor:'#fff',borderRadius:7,marginBottom:5}}>
                                <Text style={{fontSize:11,fontWeight:'800',color:'#334155'}}>Material compartido</Text>
                                <TouchableOpacity onPress={()=>handleOpenLink(r.content)}><Text style={{color:'#2563eb',fontSize:12,textDecorationLine:'underline'}}>{r.content}</Text></TouchableOpacity>
                              </View>)}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                    {cls.roles.map(roleName => {
                      const key = `${selectedSunday}_${cls.id}_${roleName}`;
                      const assigned = appState.schedule ? appState.schedule[key] : undefined;
                      const options = roleName === 'Maestro(a)' 
                        ? ['Maestro(a) 1', 'Maestro(a) 2', 'Maestro(a) 3'] 
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
                          ) : adminMode ? (
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
                          ) : <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Cupo disponible · asignación pendiente de coordinación.</Text>}
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
    maxWidth: 1180,
    flex: 1,
  },
  landingHeader: {
    width: '100%',
    backgroundColor: '#26345b',
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 3,
  },
  landingBrand: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  landingScroll: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  heroBox: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 920,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 28,
    padding: 28,
    marginTop: 18,
    marginBottom: 24,
    textAlign: 'center',
    elevation: 2,
  },
  badgePill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  badgePillText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#172554',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#53627f',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  mainCtaBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    elevation: 4,
  },
  mainCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  kidsBannerContainer: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  kidsBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350f',
    marginBottom: 14,
    textAlign: 'center',
  },
  dollsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
  },
  dollCard: {
    backgroundColor: '#fffbeb',
    width: '47%',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
  },
  dollEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  dollName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350f',
    marginBottom: 2,
  },
  dollDesc: {
    fontSize: 11,
    color: '#92400e',
    textAlign: 'center',
  },
  landingFooter: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
  },
  backToHomeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  backToHomeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#78350f',
  },
  header: {
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  sectionLabel: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  accordionContainer: { gap: 10, marginBottom: 16 },
  monthGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
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
  classesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cultoBoxTitle: {
    width: '100%',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  cultoTitleText: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  classBox: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 4,
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
  assignedText: { color: '#065f46', fontWeight: '700', fontSize: 12 },
  removeText: { color: '#dc2626', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionButton: { borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  optionButtonText: { fontSize: 11, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 6 },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  registerBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
});