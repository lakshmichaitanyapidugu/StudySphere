import React, { useState } from 'react';
import logo from '../assets/logo-v2.png';
import loginBg from '../assets/login-bg.jpg';
import { api } from '../services/api';

interface LoginProps {
  onLogin: (user: { id: number; username: string; email: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!username.trim() || !email.trim() || !password) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        if (password !== confirm) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const data = await api.auth.register(username.trim(), email.trim(), password);
        localStorage.setItem('ss_token', data.token);
        onLogin(data.user);
      } else {
        if (!email.trim() || !password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        const data = await api.auth.login(email.trim(), password);
        localStorage.setItem('ss_token', data.token);
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-center h-screen text-slate-900 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Background blobs */}
      <div className="absolute top-[-100px] left-[-100px] w-80 h-80 bg-indigo-200 rounded-full opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-96 h-96 bg-purple-200 rounded-full opacity-20 blur-3xl pointer-events-none" />

      {/* Form card */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-sm p-10 rounded-3xl shadow-2xl text-slate-900 relative z-10 border border-slate-100">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-transparent rounded-xl overflow-hidden shadow-md">
              <img src={logo} alt="StudySphere" className="h-12 w-12 object-contain" />
            </div>
            <span className="text-2xl font-extrabold text-indigo-700 tracking-tight">StudySphere</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-700">
            {isRegister ? 'Create your account' : 'Welcome back 👋'}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {isRegister ? 'Join thousands of focused learners' : 'Sign in to continue learning'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="reg-username">
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                placeholder="e.g. Lakshya"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isRegister ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isRegister ? 'Sign in' : 'Register for free'}
          </button>
        </p>
      </div>
    </div>
  );
}
