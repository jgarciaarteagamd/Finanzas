import React, { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { LogIn, LogOut, ShieldAlert } from 'lucide-react';
import { firebaseApp } from './firestoreShim.js';
import { ALLOWED_EMAILS } from './config.js';

/* Deja pasar solo a los correos de ALLOWED_EMAILS (configurado en
   el secreto ALLOWED_EMAILS de GitHub, ver la guía). Cualquier otra
   cuenta de Google ve un aviso y un botón para cerrar sesión.
   La protección real de los datos está en firestore.rules: esta
   pantalla es solo la puerta de entrada cómoda. */
export function AuthGate({ children }) {
  const [estado, setEstado] = useState('cargando'); // cargando | fuera | no-autorizado | dentro
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const auth = getAuth(firebaseApp());
    return onAuthStateChanged(auth, (u) => {
      if (!u) { setEstado('fuera'); setEmail(''); return; }
      const e = (u.email || '').toLowerCase();
      setEmail(e);
      setEstado(ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(e) ? 'no-autorizado' : 'dentro');
    });
  }, []);

  const entrar = async () => {
    setError('');
    try { await signInWithPopup(getAuth(firebaseApp()), new GoogleAuthProvider()); }
    catch (e) { if (e && e.code !== 'auth/popup-closed-by-user') setError('No se pudo iniciar sesión. Prueba de nuevo.'); }
  };
  const salir = () => signOut(getAuth(firebaseApp()));

  if (estado === 'cargando') return <div className="loading"><div className="spin" /></div>;

  if (estado === 'fuera') {
    return (
      <div className="loading" style={{ padding: 16 }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div className="brand" style={{ padding: 0, justifyContent: 'center' }}><div className="brand-mark">GA</div><div style={{ textAlign: 'left' }}><h2>Finanzas García Naranjo</h2><div className="small muted">Acceso privado de la familia</div></div></div>
          <p className="ink2">Inicia sesión con la cuenta de Gmail autorizada para ver y editar las finanzas.</p>
          <button className="btn primary" onClick={entrar}><LogIn size={16} /> Iniciar sesión con Google</button>
          {error && <div className="formerr">{error}</div>}
        </div>
      </div>
    );
  }

  if (estado === 'no-autorizado') {
    return (
      <div className="loading" style={{ padding: 16 }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <ShieldAlert size={30} style={{ color: 'var(--crit)' }} />
          <h2>Esta cuenta no tiene acceso</h2>
          <p className="ink2">{email} no está en la lista de correos autorizados. Entra con la cuenta de Juan o de Sara, o pide que os añadan.</p>
          <button className="btn" onClick={salir}><LogOut size={16} /> Cerrar sesión y probar con otra cuenta</button>
        </div>
      </div>
    );
  }

  return children;
}
