'use client';

import { useState, useEffect, useRef } from 'react';

type Tab = 'dashboard' | 'licenses' | 'piracy';

interface ActivationLog {
    id: string;
    action: string;
    domain: string | null;
    ip: string | null;
    userAgent: string | null;
    details: string | null;
    isPiracy: boolean;
    createdAt: string;
}

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
    activationLogs?: ActivationLog[];
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
        holderPhone: string | null;
        boundDomain: string | null;
        piracyAttempts: number;
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
                            placeholder="Username"
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
    const [suspiciousLicenses, setSuspiciousLicenses] = useState<License[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [detailLicense, setDetailLicense] = useState<License | null>(null);
    const [editLicense, setEditLicense] = useState<License | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'unbound' | 'expired'>('all');
    const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

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
            setSuspiciousLicenses(d.suspiciousLicenses || []);
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

    const handleEdit = async (id: string, data: Record<string, unknown>) => {
        const r = await fetch(`/api/admin/licenses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (r.ok) {
            showToast('success', 'License berhasil diupdate');
            setEditLicense(null);
            fetchLicenses();
            fetchStats();
        } else {
            showToast('error', 'Gagal mengupdate license');
        }
    };

    const copyKey = async (key: string, id: string) => {
        await navigator.clipboard.writeText(key);
        setCopiedId(id);
        showToast('success', `Key ${key} disalin ke clipboard`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const fmtDate = (d: string | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const fmtDateTime = (d: string | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    // Filter licenses
    const filteredLicenses = licenses.filter(lic => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            lic.key.toLowerCase().includes(q) ||
            lic.holderName.toLowerCase().includes(q) ||
            (lic.officeName || '').toLowerCase().includes(q) ||
            (lic.boundDomain || '').toLowerCase().includes(q) ||
            (lic.holderEmail || '').toLowerCase().includes(q) ||
            (lic.holderPhone || '').toLowerCase().includes(q);

        let matchesFilter = true;
        if (filterStatus === 'active') matchesFilter = lic.isActive;
        else if (filterStatus === 'inactive') matchesFilter = !lic.isActive;
        else if (filterStatus === 'unbound') matchesFilter = !lic.boundDomain;
        else if (filterStatus === 'expired') matchesFilter = isExpired(lic.expiresAt);

        return matchesSearch && matchesFilter;
    });

    // Compute extra stats
    const unboundCount = licenses.filter(l => !l.boundDomain && l.isActive).length;
    const expiredCount = licenses.filter(l => isExpired(l.expiresAt)).length;

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
                {tab === 'dashboard' && (
                    <DashboardTab
                        stats={stats}
                        unboundCount={unboundCount}
                        expiredCount={expiredCount}
                        recentLicenses={licenses.slice(0, 5)}
                        fmtDate={fmtDate}
                    />
                )}
                {tab === 'licenses' && (
                    <LicensesTab
                        licenses={filteredLicenses}
                        totalCount={licenses.length}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        filterStatus={filterStatus}
                        onFilterChange={setFilterStatus}
                        onUnbind={handleUnbind}
                        onToggle={handleToggleActive}
                        onCreate={() => setShowCreateModal(true)}
                        onDetail={setDetailLicense}
                        onEdit={setEditLicense}
                        onCopyKey={copyKey}
                        copiedId={copiedId}
                        fmtDate={fmtDate}
                        isExpired={isExpired}
                    />
                )}
                {tab === 'piracy' && (
                    <PiracyTab
                        logs={piracyLogs}
                        suspiciousLicenses={suspiciousLicenses}
                        fmtDate={fmtDate}
                    />
                )}
            </div>

            {showCreateModal && (
                <CreateLicenseModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreate}
                />
            )}

            {detailLicense && (
                <DetailLicenseModal
                    license={detailLicense}
                    onClose={() => setDetailLicense(null)}
                    fmtDateTime={fmtDateTime}
                    isExpired={isExpired}
                />
            )}

            {editLicense && (
                <EditLicenseModal
                    license={editLicense}
                    onClose={() => setEditLicense(null)}
                    onSave={handleEdit}
                />
            )}

            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
            )}
        </div>
    );
}

// ==================== DASHBOARD TAB ====================

function DashboardTab({ stats, unboundCount, expiredCount, recentLicenses, fmtDate }: {
    stats: Stats | null;
    unboundCount: number;
    expiredCount: number;
    recentLicenses: License[];
    fmtDate: (d: string | null) => string;
}) {
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
                <div className="stat-card">
                    <div className="stat-icon">📦</div>
                    <div className="stat-value">{unboundCount}</div>
                    <div className="stat-label">Belum Terpakai</div>
                </div>
                {expiredCount > 0 && (
                    <div className="stat-card danger">
                        <div className="stat-icon">⏰</div>
                        <div className="stat-value">{expiredCount}</div>
                        <div className="stat-label">Expired</div>
                    </div>
                )}
                <div className={`stat-card ${stats.totalPiracyAttempts > 0 ? 'danger' : ''}`}>
                    <div className="stat-icon">🚨</div>
                    <div className="stat-value">{stats.totalPiracyAttempts}</div>
                    <div className="stat-label">Percobaan Pembajakan</div>
                </div>
            </div>

            {/* Package breakdown */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📦 Distribusi Paket</span>
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

            {/* Recent licenses */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🕐 License Terbaru</span>
                </div>
                {recentLicenses.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">🔑</div>
                        <div className="empty-text">Belum ada license key</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Paket</th>
                                    <th>Pemilik</th>
                                    <th>Domain</th>
                                    <th>Status</th>
                                    <th>Dibuat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentLicenses.map(lic => {
                                    const pkg = PKG_LABELS[lic.packageType];
                                    return (
                                        <tr key={lic.id}>
                                            <td className="mono">{lic.key}</td>
                                            <td><span className={`badge ${pkg?.badge || 'badge-info'}`}>{pkg?.icon} {pkg?.label || lic.packageType}</span></td>
                                            <td>{lic.holderName}</td>
                                            <td className="mono" style={{ fontSize: 11 }}>{lic.boundDomain || <span style={{ color: '#64748b' }}>— Belum terikat</span>}</td>
                                            <td>
                                                <span className={`badge ${lic.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {lic.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(lic.createdAt)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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

function LicensesTab({ licenses, totalCount, searchQuery, onSearchChange, filterStatus, onFilterChange, onUnbind, onToggle, onCreate, onDetail, onEdit, onCopyKey, copiedId, fmtDate, isExpired }: {
    licenses: License[];
    totalCount: number;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filterStatus: string;
    onFilterChange: (f: 'all' | 'active' | 'inactive' | 'unbound' | 'expired') => void;
    onUnbind: (id: string) => void;
    onToggle: (id: string, active: boolean) => void;
    onCreate: () => void;
    onDetail: (lic: License) => void;
    onEdit: (lic: License) => void;
    onCopyKey: (key: string, id: string) => void;
    copiedId: string | null;
    fmtDate: (d: string | null) => string;
    isExpired: (d: string | null) => boolean;
}) {
    return (
        <>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔑 License Keys ({licenses.length}/{totalCount})</span>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={onCreate}>
                        ➕ Buat License
                    </button>
                </div>

                {/* Search & Filter */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <input
                        className="form-input"
                        style={{ flex: 1, minWidth: 200 }}
                        placeholder="🔍 Cari key, nama, kantor, domain, email, telepon..."
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                    <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: 150 }}
                        value={filterStatus}
                        onChange={e => onFilterChange(e.target.value as 'all' | 'active' | 'inactive' | 'unbound' | 'expired')}
                    >
                        <option value="all">📋 Semua</option>
                        <option value="active">✅ Aktif</option>
                        <option value="inactive">❌ Nonaktif</option>
                        <option value="unbound">📦 Belum Terpakai</option>
                        <option value="expired">⏰ Expired</option>
                    </select>
                </div>

                <div className="table-container">
                    {licenses.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">🔍</div>
                            <div className="empty-text">{searchQuery || filterStatus !== 'all' ? 'Tidak ada hasil' : 'Belum ada license key'}</div>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>License Key</th>
                                    <th>Paket</th>
                                    <th>Pemilik / Kantor</th>
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
                                    const expired = isExpired(lic.expiresAt);
                                    return (
                                        <tr key={lic.id} style={expired ? { opacity: 0.6 } : undefined}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="mono">{lic.key}</span>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '2px 6px', fontSize: 11 }}
                                                        onClick={() => onCopyKey(lic.key, lic.id)}
                                                        title="Salin key"
                                                    >
                                                        {copiedId === lic.id ? '✅' : '📋'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td><span className={`badge ${pkg?.badge || 'badge-info'}`}>{pkg?.icon} {pkg?.label || lic.packageType}</span></td>
                                            <td>
                                                <div>{lic.holderName}</div>
                                                {lic.officeName && <div style={{ fontSize: 11, color: '#94a3b8' }}>{lic.officeName}</div>}
                                            </td>
                                            <td className="mono" style={{ fontSize: 11 }}>{lic.boundDomain || <span style={{ color: '#64748b' }}>—</span>}</td>
                                            <td>
                                                {expired ? (
                                                    <span className="badge badge-warning">⏰ Expired</span>
                                                ) : (
                                                    <span className={`badge ${lic.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                        {lic.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: 12, color: expired ? '#ef4444' : '#94a3b8' }}>
                                                {lic.expiresAt ? fmtDate(lic.expiresAt) : '♾️ Selamanya'}
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
                                                    <button className="btn btn-ghost btn-sm" onClick={() => onDetail(lic)} title="Detail">
                                                        👁️
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(lic)} title="Edit">
                                                        ✏️
                                                    </button>
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

function PiracyTab({ logs, suspiciousLicenses, fmtDate }: {
    logs: PiracyLog[];
    suspiciousLicenses: License[];
    fmtDate: (d: string | null) => string;
}) {
    return (
        <>
            {/* Suspicious licenses summary */}
            {suspiciousLicenses.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">⚠️ License Mencurigakan ({suspiciousLicenses.length})</span>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Pemilik</th>
                                    <th>Kantor</th>
                                    <th>Telepon</th>
                                    <th>Domain Resmi</th>
                                    <th>Percobaan</th>
                                    <th>Terakhir</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suspiciousLicenses.map(lic => (
                                    <tr key={lic.id}>
                                        <td className="mono">{lic.key}</td>
                                        <td>{lic.holderName}</td>
                                        <td style={{ color: '#94a3b8' }}>{lic.officeName || '-'}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>{lic.holderPhone || '-'}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>{lic.boundDomain || '-'}</td>
                                        <td><span className="badge badge-danger">{lic.piracyAttempts}x</span></td>
                                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{fmtDate(lic.lastPiracyAt)}</td>
                                        <td>
                                            <span className={`badge ${lic.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                {lic.isActive ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Piracy logs */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🚨 Log Percobaan Pembajakan ({logs.length})</span>
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
                                        {log.license?.holderPhone && (
                                            <span style={{ color: '#94a3b8' }}> · 📱 {log.license.holderPhone}</span>
                                        )}
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
                                    {log.details && (
                                        <div className="piracy-text" style={{ marginTop: 4, fontStyle: 'italic' }}>
                                            💬 {log.details}
                                        </div>
                                    )}
                                </div>
                                {log.license?.piracyAttempts && log.license.piracyAttempts > 3 && (
                                    <div>
                                        <span className="badge badge-danger">🔥 {log.license.piracyAttempts}x total</span>
                                    </div>
                                )}
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

// ==================== DETAIL MODAL ====================

function DetailLicenseModal({ license, onClose, fmtDateTime, isExpired }: {
    license: License;
    onClose: () => void;
    fmtDateTime: (d: string | null) => string;
    isExpired: (d: string | null) => boolean;
}) {
    const pkg = PKG_LABELS[license.packageType];
    const expired = isExpired(license.expiresAt);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <h2 className="modal-title">📄 Detail License</h2>

                <div className="detail-grid">
                    <div className="detail-row">
                        <span className="detail-label">License Key</span>
                        <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{license.key}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">Paket</span>
                        <span className={`badge ${pkg?.badge}`}>{pkg?.icon} {pkg?.label}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">Status</span>
                        {expired ? (
                            <span className="badge badge-warning">⏰ Expired</span>
                        ) : (
                            <span className={`badge ${license.isActive ? 'badge-success' : 'badge-danger'}`}>
                                {license.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                            </span>
                        )}
                    </div>

                    <div className="detail-divider" />

                    <div className="detail-row">
                        <span className="detail-label">👤 Nama Notaris</span>
                        <span>{license.holderName}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">🏢 Kantor</span>
                        <span>{license.officeName || '-'}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">📧 Email</span>
                        <span>{license.holderEmail || '-'}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">📱 Telepon</span>
                        <span className="mono">{license.holderPhone || '-'}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">📍 Alamat</span>
                        <span>{license.address || '-'}</span>
                    </div>

                    <div className="detail-divider" />

                    <div className="detail-row">
                        <span className="detail-label">🌐 Domain Terikat</span>
                        <span className="mono">{license.boundDomain || '— Belum terikat'}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">📅 Dibuat</span>
                        <span>{fmtDateTime(license.createdAt)}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">🔄 Diaktifkan</span>
                        <span>{fmtDateTime(license.activatedAt)}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">⏰ Berlaku Sampai</span>
                        <span style={expired ? { color: '#ef4444', fontWeight: 600 } : undefined}>
                            {license.expiresAt ? fmtDateTime(license.expiresAt) : '♾️ Selamanya'}
                        </span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">✅ Terakhir Diverifikasi</span>
                        <span>{fmtDateTime(license.lastVerified)}</span>
                    </div>

                    {license.piracyAttempts > 0 && (
                        <>
                            <div className="detail-divider" />
                            <div className="detail-row">
                                <span className="detail-label">🚨 Percobaan Bajak</span>
                                <span className="badge badge-danger">{license.piracyAttempts}x</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Terakhir</span>
                                <span>{fmtDateTime(license.lastPiracyAt)}</span>
                            </div>
                        </>
                    )}

                    {license.notes && (
                        <>
                            <div className="detail-divider" />
                            <div className="detail-row">
                                <span className="detail-label">📝 Catatan</span>
                                <span>{license.notes}</span>
                            </div>
                        </>
                    )}

                    {/* Activation logs */}
                    {license.activationLogs && license.activationLogs.length > 0 && (
                        <>
                            <div className="detail-divider" />
                            <div style={{ marginTop: 8 }}>
                                <span className="detail-label" style={{ marginBottom: 8, display: 'block' }}>📋 Riwayat Aktivasi</span>
                                {license.activationLogs.map(log => (
                                    <div key={log.id} style={{
                                        padding: '8px 12px',
                                        background: log.isPiracy ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${log.isPiracy ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                                        borderRadius: 8,
                                        marginBottom: 6,
                                        fontSize: 12,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{log.isPiracy ? '🚨' : '✅'} {log.action}</span>
                                            <span style={{ color: '#64748b' }}>{fmtDateTime(log.createdAt)}</span>
                                        </div>
                                        {log.domain && <div style={{ color: '#94a3b8', marginTop: 2 }}>Domain: {log.domain}</div>}
                                        {log.details && <div style={{ color: '#94a3b8', marginTop: 2 }}>{log.details}</div>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
}

// ==================== EDIT MODAL ====================

function EditLicenseModal({ license, onClose, onSave }: {
    license: License;
    onClose: () => void;
    onSave: (id: string, data: Record<string, unknown>) => void;
}) {
    const [form, setForm] = useState({
        holderName: license.holderName,
        officeName: license.officeName || '',
        holderEmail: license.holderEmail || '',
        holderPhone: license.holderPhone || '',
        address: license.address || '',
        packageType: license.packageType,
        expiresAt: license.expiresAt ? license.expiresAt.split('T')[0] : '',
        notes: license.notes || '',
    });

    const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(license.id, {
            ...form,
            expiresAt: form.expiresAt || null,
            officeName: form.officeName || null,
            holderEmail: form.holderEmail || null,
            holderPhone: form.holderPhone || null,
            address: form.address || null,
            notes: form.notes || null,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">✏️ Edit License</h2>
                <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: 8 }}>
                    <span className="mono" style={{ color: '#f59e0b', fontWeight: 600 }}>{license.key}</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Paket</label>
                        <select className="form-select" value={form.packageType} onChange={e => set('packageType', e.target.value)}>
                            <option value="complete">🏆 Paket Lengkap</option>
                            <option value="no_ai">📋 Tanpa AI</option>
                            <option value="limited_ai">🤖 AI Terbatas</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nama Notaris *</label>
                        <input className="form-input" value={form.holderName} onChange={e => set('holderName', e.target.value)} required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nama Kantor</label>
                        <input className="form-input" value={form.officeName} onChange={e => set('officeName', e.target.value)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={form.holderEmail} onChange={e => set('holderEmail', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telepon</label>
                            <input className="form-input" value={form.holderPhone} onChange={e => set('holderPhone', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Alamat</label>
                        <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Berlaku Sampai</label>
                        <input className="form-input" type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Catatan</label>
                        <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>💾 Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
