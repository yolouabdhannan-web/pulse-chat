import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ImagePlus, KeyRound, Save, Trash2, UserRound } from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const passwordValid = (value) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

export default function SettingsPage() {
  const { user, updateUser, preferences, updatePreference } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [preferenceError, setPreferenceError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSaved, setProfileSaved] = useState('');
  const [passwordSaved, setPasswordSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      updatePreference('desktopNotifications', false);
      setPreferenceError('Les notifications bureau ne sont pas prises en charge par ce navigateur.');
      return;
    }
    if (Notification.permission === 'granted') {
      updatePreference('desktopNotifications', true);
      setPreferenceError('');
      return;
    }
    if (Notification.permission === 'denied') {
      setPreferenceError('Les notifications sont bloquées dans les paramètres du navigateur.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updatePreference('desktopNotifications', true);
        setPreferenceError('');
      } else {
        updatePreference('desktopNotifications', false);
        setPreferenceError('Autorisez les notifications dans la fenêtre du navigateur pour les activer.');
      }
    } catch {
      updatePreference('desktopNotifications', false);
      setPreferenceError('Impossible de demander l’autorisation des notifications.');
    }
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setProfileError('Choisissez une image JPEG, PNG, GIF ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('La photo de profil ne doit pas dépasser 5 Mo.');
      return;
    }
    setProfileError('');
    setProfileSaved('');
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setProfileError('');
    setProfileSaved('');
    try {
      let avatar = user.avatar;
      if (selectedPhoto) {
        const body = new FormData();
        body.append('file', selectedPhoto);
        const { data } = await api.post('/upload', body);
        avatar = data.file;
      }
      const { data } = await api.patch('/auth/profile', {
        username: username.trim(),
        ...(selectedPhoto ? { avatar } : {}),
      });
      updateUser(data.user);
      setSelectedPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      setProfileSaved('Votre profil a été mis à jour.');
    } catch (error) {
      setProfileError(errMsg(error, error.message));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setProfileError('');
    setProfileSaved('');
    try {
      const { data } = await api.patch('/auth/profile', { avatar: null });
      updateUser(data.user);
      setSelectedPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      setProfileSaved('Photo de profil supprimée.');
    } catch (error) {
      setProfileError(errMsg(error, error.message));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSaved('');
    if (!passwordValid(newPassword)) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved('Votre mot de passe a été changé.');
    } catch (error) {
      setPasswordError(errMsg(error, error.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[#f5f8f5] px-3 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700">Votre compte</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-950">Paramètres</h1>
          <p className="mt-2 text-sm text-emerald-950/65">Gérez votre profil, votre photo et la sécurité de votre compte.</p>
        </header>

        <form onSubmit={saveProfile} className="glass mb-5 rounded-2xl p-5 sm:p-7">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold"><UserRound size={20} className="text-emerald-800" />Profil</h2>
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Avatar name={username || user.username} size={76} avatar={photoPreview ? { url: photoPreview } : user.avatar} />
            <div className="flex flex-wrap gap-2">
              <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={choosePhoto} />
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="btn-ghost"><ImagePlus size={16} />Choisir une photo</button>
              {user.avatar && <button type="button" onClick={removePhoto} disabled={busy} className="btn-ghost"><Trash2 size={16} />Supprimer la photo</button>}
              <p className="basis-full text-xs text-slate-600">JPEG, PNG, GIF ou WebP · 5 Mo maximum</p>
            </div>
          </div>
          <label className="mb-4 block text-sm font-semibold text-emerald-950" htmlFor="settings-username">Pseudo</label>
          <input id="settings-username" className="field mb-4" value={username} maxLength={24} minLength={3}
            onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          <p className="-mt-2 mb-4 text-xs text-slate-600">3 à 24 caractères : lettres, chiffres et _</p>
          {profileError && <p role="alert" className="mb-3 flex items-center gap-2 text-sm text-emerald-900"><AlertCircle size={16} />{profileError}</p>}
          {profileSaved && <p role="status" className="mb-3 flex items-center gap-2 text-sm text-emerald-800"><Check size={16} />{profileSaved}</p>}
          <button type="submit" disabled={busy || !username.trim()} className="btn-grad"><Save size={16} />Enregistrer le profil</button>
        </form>

        <form onSubmit={changePassword} className="glass rounded-2xl p-5 sm:p-7">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><KeyRound size={20} className="text-emerald-800" />Mot de passe</h2>
          <p className="mb-5 text-sm text-emerald-950/65">Choisissez un nouveau mot de passe. Il ne sera jamais affiché en clair dans votre compte.</p>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-emerald-950">Mot de passe actuel<input className="field mt-1.5" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label className="block text-sm font-semibold text-emerald-950">Nouveau mot de passe<input className="field mt-1.5" type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label className="block text-sm font-semibold text-emerald-950">Confirmer le nouveau mot de passe<input className="field mt-1.5" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <p className="text-xs text-slate-600">8 caractères minimum, avec au moins une lettre et un chiffre.</p>
          </div>
          {passwordError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-emerald-900"><AlertCircle size={16} />{passwordError}</p>}
          {passwordSaved && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><Check size={16} />{passwordSaved}</p>}
          <button type="submit" disabled={busy || !currentPassword || !newPassword || !confirmPassword} className="btn-grad mt-5"><KeyRound size={16} />Changer le mot de passe</button>
        </form>

        <section className="glass mt-5 rounded-2xl p-5 sm:p-7">
          <h2 className="mb-1 text-lg font-bold text-emerald-950">Préférences de discussion</h2>
          <p className="mb-5 text-sm text-emerald-950/65">Ces préférences sont enregistrées sur cet appareil.</p>
          <div className="divide-y divide-emerald-100">
            <PreferenceToggle title="Thème sombre" description="Activer le thème sombre sur l’ensemble de l’application."
              checked={preferences.theme === 'dark'} onChange={(value) => updatePreference('theme', value ? 'dark' : 'light')} />
            <PreferenceToggle title="Envoyer avec Entrée" description="Appuyez sur Entrée pour envoyer ; Maj + Entrée ajoute une nouvelle ligne."
              checked={preferences.sendOnEnter} onChange={(value) => updatePreference('sendOnEnter', value)} />
            <PreferenceToggle title="Messages compacts" description="Réduire l’espace entre les messages pour afficher plus de la conversation."
              checked={preferences.compactMessages} onChange={(value) => updatePreference('compactMessages', value)} />
            <PreferenceToggle title="Réduire les animations" description="Limiter les transitions animées dans l’interface."
              checked={preferences.reduceMotion} onChange={(value) => updatePreference('reduceMotion', value)} />
            <PreferenceToggle title="Notifications bureau" description="Recevoir une notification lorsqu’un nouveau message arrive dans une autre discussion."
              checked={preferences.desktopNotifications && (typeof Notification === 'undefined' || Notification.permission === 'granted')}
              onChange={(value) => {
                if (value) enableNotifications();
                else {
                  updatePreference('desktopNotifications', false);
                  setPreferenceError('');
                }
              }} />
          </div>
          {preferenceError && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-emerald-900"><AlertCircle size={16} />{preferenceError}</p>}
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-emerald-950">Taille du texte des messages</p>
            <div className="grid grid-cols-3 gap-2">
              {[['small', 'Petite'], ['normal', 'Normale'], ['large', 'Grande']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={preferences.textSize === value}
                  onClick={() => updatePreference('textSize', value)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${preferences.textSize === value ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-emerald-200 bg-white text-emerald-950 hover:bg-emerald-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PreferenceToggle({ title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-emerald-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-800' : 'bg-emerald-200'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
