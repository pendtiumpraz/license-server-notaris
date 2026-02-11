'use client';

import { useState, useEffect, useRef } from 'react';

type Tab = 'dashboard' | 'licenses' | 'piracy';

interface License {
    id: string;
    key: string;
    packageType: string;
    holderName: string;
    officeName: string | null;
    holderEmail: string | null;
    holderPhone: string | null;
    address: string | null;
    boundDomain: string | null;
    isActive: boolean;
    activatedAt: string | null;
    expiresAt: string | null;
    lastVerified: string | null;
    piracyAttempts: number;
    lastPiracyAt: string | null;
    notes: string | null;
    createdAt: string;
}

interface Stats {
    total: number;
    active: number;
    bound: number;
    totalPiracyAttempts: number;
    byPackage: Record<string, number>;
    piracyHotspots: Array<{
        key: string;
        holderName: string;
        officeName: string | null;
        piracyAttempts: number;
        lastPiracyAt: string | null;
    }>;
}

interface PiracyLog {
    id: string;
    action: string;
    domain: string | null;
    ip: string | null;
    userAgent: string | null;
    details: string | null;
    createdAt: string;
    license: {
        key: string;
        holderName: string;
        officeName: string | null;
        boundDomain: string | null;
    };
}

const PKG_LABELS: Record<string, { label: string; icon: string; badge: string }> = {
    complete: { label: 'Paket Lengkap', icon: '🏆', badge: 'badge-success' },
    no_ai: { label: 'Tanpa AI', icon: '📋', badge: 'badge-info' },
    limited_ai: { label: 'AI Terbatas', icon: '🤖', badge: 'badge-purple' },
};

export default function HomePage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        fetch('/api/auth').then(r => {
            setIsLoggedIn(r.ok);
            setIsCheckingAuth(false);
        }).catch(() => setIsCheckingAuth(false));
    }, []);

    if (isCheckingAuth) {
        return <div className="login-container"><p style={{ color: '#64748b' }}>Memuat...</p></div>;
    }

    if (!isLoggedIn) {
        return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
    }

    return <Dashboard onLogout={() => setIsLoggedIn(false)} />;
}

// ==================== LOGIN ====================

function LoginPage({ onLogin }: { onLogin: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
            onLogin();
        } else {
            const data = await res.json();
            setError(data.error || 'Login gagal');
        }
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo">🔑</div>
                <h1 className="login-title">License Server</h1>
                <p className="login-subtitle">Notaris Portal System</p>

                {error && <div className="error-msg">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="admin"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? '⏳ Masuk...' : '🔓 Masuk'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ==================== DASHBOARD ====================

function Dashboard({ onLogout }: { onLogout: () => void }) {
    const [tab, setTab] = useState<Tab>('dashboard');
    const [stats, setStats] = useState<Stats | null>(null);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [piracyLogs, setPiracyLogs] = useState<PiracyLog[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);

    const showToast = (type: string, msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const initialized = useRef(false);

    const fetchStats = async () => {
        const r = await fetch('/api/admin/stats');
        if (r.ok) setStats(await r.json());
    };

    const fetchLicenses = async () => {
        const r = await fetch('/api/admin/licenses');
        if (r.ok) {
            const d = await r.json();
            setLicenses(d.licenses || []);
        }
    };

    const fetchPiracy = async () => {
        const r = await fetch('/api/admin/piracy');
        if (r.ok) {
            const d = await r.json();
            setPiracyLogs(d.piracyLogs || []);
        }
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        fetchStats();
        fetchLicenses();
        fetchPiracy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        onLogout();
    };

    const handleUnbind = async (id: string) => {
        if (!confirm('Lepas binding domain? License bisa diaktifkan di domain lain.')) return;
        const r = await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
        if (r.ok) {
            showToast('success', 'Domain berhasil dilepas');
            fetchLicenses();
            fetchStats();
        }
    };

    const handleToggleActive = async (id: string, currentlyActive: boolean) => {
        const action = currentlyActive ? 'nonaktifkan' : 'aktifkan';
        if (!confirm(`Yakin ${action} license ini?`)) return;
        const r = await fetch(`/api/admin/licenses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !currentlyActive }),
        });
        if (r.ok) {
            showToast('success', `License berhasil di-${action}`);
            fetchLicenses();
            fetchStats();
        }
    };

    const handleCreate = async (data: Record<string, string>) => {
        const r = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (r.ok) {
            const result = await r.json();
            showToast('success', `License dibuat: ${result.license.key}`);
            setShowCreateModal(false);
            fetchLicenses();
            fetchStats();
        } else {
            const err = await r.json();
            showToast('error', err.error || 'Gagal membuat license');
        }
    };

    const fmtDate = (d: string | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="dashboard">
            {/* Topbar */}
            <div className="topbar">
                <div className="topbar-brand">
                    <div className="topbar-logo">🔑</div>
                    <div>
                        <div className="topbar-title">License Server</div>
                        <div className="topbar-sub">Notaris Portal System</div>
                    </div>
                </div>

                <div className="topbar-nav">
                    <button className={`nav-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
                        📊 Dashboard
                    </button>
                    <button className={`nav-btn ${tab === 'licenses' ? 'active' : ''}`} onClick={() => setTab('licenses')}>
                        🔑 License Keys
                    </button>
                    <button className={`nav-btn ${tab === 'piracy' ? 'active' : ''}`} onClick={() => setTab('piracy')}>
                        🚨 Piracy {stats && stats.totalPiracyAttempts > 0 && (
                            <span className="badge badge-danger" style={{ marginLeft: 4 }}>{stats.totalPiracyAttempts}</span>
                        )}
                    </button>
                    <button className="nav-btn" onClick={handleLogout}>🚪 Logout</button>
                </div>
            </div>

            <div className="main-content">
                {tab === 'dashboard' && <DashboardTab stats={stats} />}
                {tab === 'licenses' && (
                    <LicensesTab
                        licenses={licenses}
                        onUnbind={handleUnbind}
                        onToggle={handleToggleActive}
                        onCreate={() => setShowCreateModal(true)}
                        fmtDate={fmtDate}
                    />
                )}
                {tab === 'piracy' && <PiracyTab logs={piracyLogs} fmtDate={fmtDate} />}
            </div>

            {showCreateModal && (
                <CreateLicenseModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreate}
                />
            )}

            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
            )}
        </div>
    );
}

// ==================== DASHBOARD TAB ====================

function DashboardTab({ stats }: { stats: Stats | null }) {
    if (!stats) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Memuat statistik...</div></div>;

    return (
        <>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">🔑</div>
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total License Keys</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value">{stats.active}</div>
                    <div className="stat-label">Aktif</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🌐</div>
                    <div className="stat-value">{stats.bound}</div>
                    <div className="stat-label">Terikat Domain</div>
                </div>
                <div className={`stat-card ${stats.totalPiracyAttempts > 0 ? 'danger' : ''}`}>
                    <div className="stat-icon">🚨</div>
                    <div className="stat-value">{stats.totalPiracyAttempts}</div>
                    <div className="stat-label">Percobaan Pembajakan</div>
                </div>
            </div>

            {/* Package breakdown */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📦 Per Paket</span>
                </div>
                <div className="card-body">
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        {Object.entries(PKG_LABELS).map(([key, info]) => (
                            <div key={key} className="stat-card">
                                <div className="stat-icon">{info.icon}</div>
                                <div className="stat-value">{stats.byPackage[key] || 0}</div>
                                <div className="stat-label">{info.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Piracy hotspots */}
            {stats.piracyHotspots.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">🚨 License Tersering Dibajak</span>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Pemilik</th>
                                    <th>Kantor</th>
                                    <th>Percobaan</th>
                                    <th>Terakhir</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.piracyHotspots.map((h, i) => (
                                    <tr key={i}>
                                        <td className="mono">{h.key}</td>
                                        <td>{h.holderName}</td>
                                        <td>{h.officeName || '-'}</td>
                                        <td><span className="badge badge-danger">{h.piracyAttempts}x</span></td>
                                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{h.lastPiracyAt ? new Date(h.lastPiracyAt).toLocaleString('id-ID') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}

// ==================== LICENSES TAB ====================

function LicensesTab({ licenses, onUnbind, onToggle, onCreate, fmtDate }: {
    licenses: License[];
    onUnbind: (id: string) => void;
    onToggle: (id: string, active: boolean) => void;
    onCreate: () => void;
    fmtDate: (d: string | null) => string;
}) {
    return (
        <>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔑 License Keys ({licenses.length})</span>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={onCreate}>
                        ➕ Buat License
                    </button>
                </div>
                <div className="table-container">
                    {licenses.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">🔑</div>
                            <div className="empty-text">Belum ada license key</div>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>License Key</th>
                                    <th>Paket</th>
                                    <th>Pemilik</th>
                                    <th>Kantor</th>
                                    <th>Domain</th>
                                    <th>Status</th>
                                    <th>Berlaku</th>
                                    <th>Bajak</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {licenses.map(lic => {
                                    const pkg = PKG_LABELS[lic.packageType];
                                    return (
                                        <tr key={lic.id}>
                                            <td className="mono">{lic.key}</td>
                                            <td><span className={`badge ${pkg?.badge || 'badge-info'}`}>{pkg?.icon} {pkg?.label || lic.packageType}</span></td>
                                            <td>{lic.holderName}</td>
                                            <td style={{ color: '#94a3b8' }}>{lic.officeName || '-'}</td>
                                            <td className="mono" style={{ fontSize: 11 }}>{lic.boundDomain || <span style={{ color: '#64748b' }}>—</span>}</td>
                                            <td>
                                                <span className={`badge ${lic.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {lic.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                {lic.expiresAt ? fmtDate(lic.expiresAt) : '♾️'}
                                            </td>
                                            <td>
                                                {lic.piracyAttempts > 0 ? (
                                                    <span className="badge badge-danger">{lic.piracyAttempts}x</span>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>-</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="actions">
                                                    {lic.boundDomain && (
                                                        <button className="btn btn-ghost btn-sm" onClick={() => onUnbind(lic.id)} title="Lepas domain">
                                                            🔓
                                                        </button>
                                                    )}
                                                    <button
                                                        className={`btn btn-sm ${lic.isActive ? 'btn-danger' : 'btn-success'}`}
                                                        onClick={() => onToggle(lic.id, lic.isActive)}
                                                        title={lic.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                    >
                                                        {lic.isActive ? '⛔' : '✅'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}

// ==================== PIRACY TAB ====================

function PiracyTab({ logs, fmtDate }: { logs: PiracyLog[]; fmtDate: (d: string | null) => string }) {
    return (
        <>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🚨 Percobaan Pembajakan ({logs.length})</span>
                </div>
                {logs.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">🛡️</div>
                        <div className="empty-text">Tidak ada percobaan pembajakan terdeteksi</div>
                    </div>
                ) : (
                    <div style={{ padding: 16 }}>
                        {logs.map(log => (
                            <div key={log.id} className="piracy-alert">
                                <div className="piracy-icon">⚠️</div>
                                <div style={{ flex: 1 }}>
                                    <div className="piracy-text">
                                        <strong>{log.license?.holderName || '-'}</strong>
                                        {log.license?.officeName && ` (${log.license.officeName})`}
                                    </div>
                                    <div className="piracy-text" style={{ marginTop: 4 }}>
                                        Key: <span className="mono">{log.license?.key}</span> ·
                                        Domain resmi: <strong>{log.license?.boundDomain || '-'}</strong> →
                                        Dicoba dari: <strong style={{ color: '#ef4444' }}>{log.domain}</strong>
                                    </div>
                                    <div className="piracy-text" style={{ marginTop: 4 }}>
                                        IP: <span className="mono">{log.ip || '-'}</span> ·
                                        {fmtDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('id-ID')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ==================== CREATE MODAL ====================

function CreateLicenseModal({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (data: Record<string, string>) => void;
}) {
    const [form, setForm] = useState({
        packageType: 'complete',
        holderName: '',
        officeName: '',
        holderEmail: '',
        holderPhone: '',
        address: '',
        expiresAt: '',
        notes: '',
    });

    const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.holderName.trim()) return;
        onCreate(form);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">🔑 Buat License Key Baru</h2>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Paket *</label>
                        <select className="form-select" value={form.packageType} onChange={e => set('packageType', e.target.value)}>
                            <option value="complete">🏆 Paket Lengkap</option>
                            <option value="no_ai">📋 Tanpa AI</option>
                            <option value="limited_ai">🤖 AI Terbatas</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nama Notaris / PIC *</label>
                        <input className="form-input" value={form.holderName} onChange={e => set('holderName', e.target.value)} placeholder="Budi Santoso, S.H., M.Kn." required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nama Kantor Notaris</label>
                        <input className="form-input" value={form.officeName} onChange={e => set('officeName', e.target.value)} placeholder="Kantor Notaris Budi Santoso" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={form.holderEmail} onChange={e => set('holderEmail', e.target.value)} placeholder="email@notaris.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telepon</label>
                            <input className="form-input" value={form.holderPhone} onChange={e => set('holderPhone', e.target.value)} placeholder="08123456789" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Alamat Kantor</label>
                        <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Jl. Merdeka No. 1, Jakarta" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Berlaku Sampai (kosongkan = selamanya)</label>
                        <input className="form-input" type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Catatan</label>
                        <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Catatan internal..." />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>🔑 Buat License Key</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
