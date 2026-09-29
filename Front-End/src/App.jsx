import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
const assetOrigin = new URL(
  import.meta.env.VITE_ASSET_URL || import.meta.env.VITE_API_URL || window.location.origin,
  window.location.origin
).origin;

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('moviehubAuth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatPrice = (amount) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'RWF',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

function MoviePoster({ path: posterPath, className = '' }) {
  const [failed, setFailed] = useState(false);
  const posterUrl = posterPath
    ? `${assetOrigin}${posterPath.startsWith('/uploads/') ? posterPath : `/uploads/posters/${posterPath.split(/[\\/]/).pop()}`}`
    : '';

  return posterUrl && !failed
    ? <img className={`poster-image ${className}`} src={posterUrl} alt="Movie poster" onError={() => setFailed(true)} />
    : <div className={`poster placeholder ${className}`} />;
}

function BrandLogo({ className = '' }) {
  return (
    <Link to="/" className={`brand-lockup ${className}`} aria-label="MovieHub home">
      <img src="/logo.png" alt="MovieHub logo" />
      <span>MovieHub</span>
    </Link>
  );
}

function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  useEffect(() => {
    if (!auth) {
      localStorage.removeItem('moviehubAuth');
      return;
    }

    localStorage.setItem('moviehubAuth', JSON.stringify(auth));
  }, [auth]);

  const handleLogout = () => setAuth(null);

  return (
    <Routes>
      <Route path="/" element={<HomePage auth={auth} onLogout={handleLogout} />} />
      <Route path="/movies" element={<MovieListPage auth={auth} onLogout={handleLogout} />} />
      <Route path="/movies/:id" element={<MovieDetailPage auth={auth} onLogout={handleLogout} />} />
      <Route path="/account" element={auth?.token ? <AccountPage auth={auth} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage setAuth={setAuth} />} />
      <Route path="/register" element={<RegisterPage setAuth={setAuth} />} />
      <Route path="/admin/login" element={<AdminLoginPage setAuth={setAuth} />} />
      <Route path="/admin" element={auth?.user?.role === 'admin' ? <AdminDashboardPage auth={auth} onLogout={handleLogout} /> : <Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function TopNav({ auth, onLogout }) {
  return (
    <header className="topbar">
      <BrandLogo />
      <nav>
        <Link to="/">Home</Link>
        <Link to="/movies">Movies</Link>
        {auth?.user ? (
          <>
            {auth.user.role !== 'admin' && <Link to="/account">My library</Link>}
            {auth.user.role === 'admin' && <Link to="/admin">Admin</Link>}
            <button className="secondary-btn" type="button" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            <Link to="/admin/login">Admin</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function HomePage({ auth, onLogout }) {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    api.get('/movies', { params: { limit: 3 } })
      .then((response) => setMovies(response.data.movies || []))
      .catch(() => setMovies([]));
  }, []);

  return (
    <div className="page-shell">
      <TopNav auth={auth} onLogout={onLogout} />

      <main className="hero-section">
        <div>
          <p className="eyebrow">Local movie marketplace</p>
          <h1>Find your next watch.</h1>
          <p>
            Browse movies, pay securely using the configured local payment number, and unlock downloads after admin approval.
          </p>
          <div className="cta-row">
            <Link to="/movies" className="primary-btn">Browse movies</Link>
            <Link to="/register" className="secondary-btn">Create account</Link>
          </div>
        </div>

        <div className="hero-card">
          <h3>Featured title</h3>
          <p className="movie-price">{movies[0] ? formatPrice(movies[0].price_rwf) : 'RWF 2,500'}</p>
          <span className="status-pill">{movies[0]?.status === 'published' ? 'Published' : 'Fresh pick'}</span>
        </div>
      </main>

      <section className="section-grid">
        <div className="info-card">
          <h3>Local-first workflow</h3>
          <p>Everything runs locally on your machine with XAMPP and MySQL.</p>
        </div>
        <div className="info-card">
          <h3>Manual verification</h3>
          <p>Payments are reviewed by admin before any movie access is granted.</p>
        </div>
        <div className="info-card">
          <h3>Protected downloads</h3>
          <p>Users can only download movies with an active approved purchase.</p>
        </div>
      </section>

      <section className="content-card">
        <h2>Trending now</h2>
        <div className="movie-grid">
          {(movies.length ? movies : [
            { id: 1, title: 'The Last Patrol', category_name: 'Action', price_rwf: 2500, release_year: 2024 },
            { id: 2, title: 'Midnight Bloom', category_name: 'Drama', price_rwf: 1800, release_year: 2023 },
          ]).map((movie) => (
            <div key={movie.id} className="movie-card">
              <MoviePoster path={movie.poster_path} />
              <h3>{movie.title}</h3>
              <p>{movie.category_name || 'Featured'}</p>
              <div className="meta-row">
                <span>{movie.release_year || '2024'}</span>
                <span>{formatPrice(movie.price_rwf)}</span>
              </div>
              <Link to={`/movies/${movie.id}`} className="primary-btn small-btn">View details</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MovieListPage({ auth, onLogout }) {
  const [movies, setMovies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    api.get('/movies/categories')
      .then((response) => setCategories(response.data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    api.get('/movies', {
      params: {
        search,
        category: selectedCategory,
        sort,
        limit: 12,
      },
    })
      .then((response) => setMovies(response.data.movies || []))
      .catch(() => setMovies([]));
  }, [search, selectedCategory, sort]);

  return (
    <div className="page-shell">
      <TopNav auth={auth} onLogout={onLogout} />

      <main className="content-card">
        <h2>Movie catalog</h2>
        <div className="meta-row" style={{ alignItems: 'center', marginBottom: '1.25rem' }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search movies"
            style={{ maxWidth: '260px' }}
          />
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>

        <div className="movie-grid">
          {movies.map((movie) => (
            <div key={movie.id} className="movie-card">
              <MoviePoster path={movie.poster_path} />
              <h3>{movie.title}</h3>
              <p>{movie.category_name || 'General'}</p>
              <div className="meta-row">
                <span>{movie.release_year || '2024'}</span>
                <span>{formatPrice(movie.price_rwf)}</span>
              </div>
              <Link to={`/movies/${movie.id}`} className="primary-btn small-btn">View details</Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function MovieDetailPage({ auth, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/movies/${id}`)
      .then((response) => setMovie(response.data.movie))
      .catch(() => setMovie(null));
  }, [id]);

  const handleBuy = async () => {
    if (!auth?.token) {
      navigate('/login');
      return;
    }

    try {
      const response = await api.post('/payments/orders', { movieId: Number(id) }, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      setOrder(response.data.order);
      setMessage('Order created. Complete payment using the details below, then submit your transaction reference for manual review.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to create your order right now.');
    }
  };

  if (!movie) {
    return <div className="page-shell"><TopNav auth={auth} onLogout={onLogout} /><p>Loading movie...</p></div>;
  }

  return (
    <div className="page-shell">
      <TopNav auth={auth} onLogout={onLogout} />
      <main className="detail-layout">
        <MoviePoster path={movie.poster_path} className="large" />
        <div>
          <p className="eyebrow">{movie.category_name || 'Featured'}</p>
          <h1>{movie.title}</h1>
          <p className="description">{movie.description || 'No summary given yet.'}</p>
          <div className="meta-row large-gap">
            <span>{movie.release_year || '2024'}</span>
            <span>{movie.duration_minutes || 120} min</span>
            <span>{movie.language || 'English'}</span>
          </div>
          <div className="price-block">{formatPrice(movie.price_rwf)}</div>
          <button className="primary-btn" type="button" onClick={handleBuy}>Buy movie</button>
          {message && <p style={{ marginTop: '1rem', color: '#a7b4c4' }}>{message}</p>}
          {order?.paymentSettings && (
            <div className="payment-destination">
              <h3>Payment instructions</h3>
              <p><strong>Order:</strong> {order.orderReference}</p>
              <p><strong>Amount:</strong> {formatPrice(order.amountRwf)}</p>
              <p><strong>Method:</strong> {order.paymentSettings.provider_name}</p>
              <p><strong>Send to:</strong> {order.paymentSettings.payment_phone_number}</p>
              {order.paymentSettings.account_name && <p><strong>Account:</strong> {order.paymentSettings.account_name}</p>}
              <p>{order.paymentSettings.instructions}</p>
              <p className="notice">Payment is not verified automatically. An admin checks the official payment records before activating your purchase.</p>
              <Link to="/account" className="primary-btn small-btn">Submit payment reference</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AccountPage({ auth, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [settings, setSettings] = useState(null);
  const [forms, setForms] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAccount = async () => {
    const headers = { Authorization: `Bearer ${auth.token}` };
    try {
      const [orderResponse, purchaseResponse, settingsResponse] = await Promise.all([
        api.get('/payments/orders/my', { headers }),
        api.get('/payments/purchases/my', { headers }),
        api.get('/payments/settings'),
      ]);
      setOrders(orderResponse.data.orders || []);
      setPurchases(purchaseResponse.data.purchases || []);
      setSettings(settingsResponse.data.settings);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load your account.');
    }
  };

  useEffect(() => {
    loadAccount();
  }, [auth.token]);

  const updateForm = (orderId, field, value) => {
    setForms((current) => ({
      ...current,
      [orderId]: { ...current[orderId], [field]: value },
    }));
  };

  const submitPayment = async (event, order) => {
    event.preventDefault();
    const form = forms[order.id] || {};
    setError('');
    setMessage('');

    try {
      const response = await api.post(`/payments/orders/${order.id}/submit`, {
        transactionReference: form.transactionReference || '',
        senderPhone: form.senderPhone || '',
        submittedAmountRwf: Number(order.amount_rwf),
        notes: form.notes || '',
      }, { headers: { Authorization: `Bearer ${auth.token}` } });
      setMessage(response.data.message);
      await loadAccount();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit payment details.');
    }
  };

  const downloadMovie = async (movieId, title) => {
    try {
      const response = await api.get(`/movies/${movieId}/download`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.mp4`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Download could not be started.');
    }
  };

  return (
    <div className="page-shell">
      <TopNav auth={auth} onLogout={onLogout} />
      <main className="content-card">
        <div className="section-heading">
          <div><p className="eyebrow">Your account</p><h2>Orders and library</h2></div>
          <button className="secondary-btn" type="button" onClick={loadAccount}>Refresh</button>
        </div>
        {message && <p className="notice success-notice">{message}</p>}
        {error && <p className="notice error-notice">{error}</p>}

        <section className="account-section">
          <h3>Payment orders</h3>
          {orders.length === 0 && <p>No payment orders yet.</p>}
          <div className="management-list">
            {orders.map((order) => {
              const canSubmit = order.status === 'pending';
              return (
                <article className="management-row" key={order.id}>
                  <div className="row-main">
                    <div><h4>{order.movie_title}</h4><p>{order.order_reference} · {formatPrice(order.amount_rwf)}</p></div>
                    <span className={`state-badge state-${order.status}`}>{order.latest_submission_status || order.status}</span>
                  </div>
                  {canSubmit && (
                    <>
                      {settings?.is_active ? (
                        <div className="payment-destination compact-destination">
                          <p><strong>{settings.provider_name}:</strong> {settings.payment_phone_number} {settings.account_name ? `(${settings.account_name})` : ''}</p>
                          <p>Transfer exactly {formatPrice(order.amount_rwf)}. Admin verification is manual; a reference or note is evidence for review, not automatic confirmation.</p>
                        </div>
                      ) : <p className="notice">The payment destination is currently inactive. Contact the administrator before transferring funds; you may still submit details for a transfer already made.</p>}
                      <form className="payment-form" onSubmit={(event) => submitPayment(event, order)}>
                        <input
                          aria-label="Transaction reference"
                          placeholder="Transaction reference"
                          value={forms[order.id]?.transactionReference || ''}
                          onChange={(event) => updateForm(order.id, 'transactionReference', event.target.value)}
                        />
                        <input
                          aria-label="Sender phone"
                          placeholder="Sender phone (optional)"
                          value={forms[order.id]?.senderPhone || ''}
                          onChange={(event) => updateForm(order.id, 'senderPhone', event.target.value)}
                        />
                        <textarea
                          aria-label="Payment proof details"
                          placeholder="Payment proof details or notes"
                          value={forms[order.id]?.notes || ''}
                          onChange={(event) => updateForm(order.id, 'notes', event.target.value)}
                        />
                        <button className="primary-btn" type="submit">Submit for review</button>
                      </form>
                    </>
                  )}
                  {order.status === 'submitted' && <p className="notice">Payment details received. Your download remains locked until an admin verifies and approves this payment.</p>}
                  {order.status === 'rejected' && <p className="notice error-notice">Payment rejected{order.rejection_reason ? `: ${order.rejection_reason}` : '.'} Create a new order to try again.</p>}
                  {order.status === 'expired' && <p className="notice">This order expired. Return to the movie page to create a new order.</p>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="account-section">
          <h3>Purchased movies</h3>
          {purchases.length === 0 && <p>Approved purchases will appear here.</p>}
          <div className="management-list">
            {purchases.map((purchase) => (
              <article className="management-row row-main" key={purchase.id}>
                <div><h4>{purchase.movie_title}</h4><p>{formatPrice(purchase.amount_paid_rwf)} · {purchase.order_reference}</p></div>
                <button className="primary-btn" type="button" onClick={() => downloadMovie(purchase.movie_id, purchase.movie_title)}>Download</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginPage({ setAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await api.post('/auth/login', form);
      const user = response.data.user;
      const nextAuth = { token: response.data.token, user: { ...user, role: user.role } };
      setAuth(nextAuth);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to log in.');
    }
  };

  return (
    <div className="page-shell auth-shell">
      <BrandLogo className="auth-brand" />
      <div className="auth-card">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" required />
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" required />
          <button type="submit" className="primary-btn full-width">Login</button>
        </form>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <p>
          Need an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

function RegisterPage({ setAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await api.post('/auth/register', form);
      setAuth({ token: response.data.token, user: response.data.user });
      navigate('/');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account.');
    }
  };

  return (
    <div className="page-shell auth-shell">
      <BrandLogo className="auth-brand" />
      <div className="auth-card">
        <h2>Create account</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Full name" required />
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" required />
          <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" />
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" required />
          <button type="submit" className="primary-btn full-width">Register</button>
        </form>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
      </div>
    </div>
  );
}

function AdminLoginPage({ setAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await api.post('/auth/login', form);
      const user = response.data.user;

      if (user.role !== 'admin') {
        setError('This account is not an admin account.');
        return;
      }

      setAuth({ token: response.data.token, user });
      navigate('/admin');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in as admin.');
    }
  };

  return (
    <div className="page-shell auth-shell">
      <BrandLogo className="auth-brand" />
      <div className="auth-card">
        <h2>Admin login</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Admin email" required />
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" required />
          <button type="submit" className="primary-btn full-width">Login as admin</button>
        </form>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
      </div>
    </div>
  );
}

function AdminDashboardPage({ auth, onLogout }) {
  const [tab, setTab] = useState('overview');

  return (
    <div className="page-shell">
      <TopNav auth={auth} onLogout={onLogout} />
      <main className="content-card">
        <p className="eyebrow">Administration</p>
        <h2>MovieHub control room</h2>
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          {['overview', 'movies', 'payments', 'users', 'purchases', 'settings'].map((item) => (
            <button key={item} className={tab === item ? 'tab-button active' : 'tab-button'} onClick={() => setTab(item)} type="button">
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'overview' && <AdminOverview auth={auth} />}
        {tab === 'movies' && <AdminMovies auth={auth} />}
        {tab === 'payments' && <AdminPayments auth={auth} />}
        {tab === 'users' && <AdminUsers auth={auth} />}
        {tab === 'purchases' && <AdminPurchases auth={auth} />}
        {tab === 'settings' && <AdminSettings auth={auth} />}
      </main>
    </div>
  );
}

function useAdminData(auth, path, key) {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    api.get(path, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then((response) => setData(response.data[key] || []))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load data.'));
  }, [auth.token, path, key, refresh]);

  return { data, error, reload: () => setRefresh((value) => value + 1) };
}

function AdminOverview({ auth }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard', { headers: { Authorization: `Bearer ${auth.token}` } })
      .then((response) => setStats(response.data.stats))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load dashboard.'));
  }, [auth.token]);

  if (error) return <p className="notice error-notice">{error}</p>;
  if (!stats) return <p>Loading dashboard...</p>;

  return (
    <div className="section-grid admin-stat-grid">
      <div className="info-card"><h3>Users</h3><p>{stats.totalUsers}</p></div>
      <div className="info-card"><h3>Published movies</h3><p>{stats.publishedMovies} / {stats.totalMovies}</p></div>
      <div className="info-card"><h3>Awaiting review</h3><p>{stats.pendingPayments}</p></div>
      <div className="info-card"><h3>Approved payments</h3><p>{stats.approvedPayments}</p></div>
      <div className="info-card"><h3>Rejected payments</h3><p>{stats.rejectedPayments}</p></div>
      <div className="info-card"><h3>Approved total</h3><p>{formatPrice(stats.totalApprovedPurchaseAmount)}</p></div>
    </div>
  );
}

const emptyMovieForm = {
  title: '', description: '', categoryId: '', genre: '', releaseYear: '', durationMinutes: '',
  language: '', country: '', priceRwf: '', status: 'published',
};

function AdminMovies({ auth }) {
  const { data: movies, error, reload } = useAdminData(auth, '/movies/admin/all', 'movies');
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyMovieForm);
  const [movieFile, setMovieFile] = useState(null);
  const [poster, setPoster] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/movies/categories').then((response) => setCategories(response.data.categories || []));
  }, []);

  const headers = { Authorization: `Bearer ${auth.token}` };
  const submitMovie = async (event) => {
    event.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (movieFile) data.append('movieFile', movieFile);
    if (poster) data.append('poster', poster);
    try {
      const response = editingId
        ? await api.put(`/movies/${editingId}`, data, { headers })
        : await api.post('/movies', data, { headers });
      setMessage(response.data.message || 'Movie saved.');
      setForm(emptyMovieForm);
      setMovieFile(null);
      setPoster(null);
      setEditingId(null);
      event.target.reset();
      reload();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Could not save movie.');
    }
  };

  const editMovie = (movie) => {
    setEditingId(movie.id);
    setForm({
      title: movie.title || '', description: movie.description || '', categoryId: movie.category_id || '',
      genre: movie.genre || '', releaseYear: movie.release_year || '', durationMinutes: movie.duration_minutes || '',
      language: movie.language || '', country: movie.country || '', priceRwf: movie.price_rwf || '', status: movie.status,
    });
    setMovieFile(null);
    setPoster(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const archiveMovie = async (movie) => {
    if (!window.confirm(`Archive ${movie.title}?`)) return;
    try {
      await api.delete(`/movies/${movie.id}`, { headers });
      reload();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Could not archive movie.');
    }
  };

  const field = (name, label, type = 'text', required = false) => (
    <label className="form-field" key={name}>{label}
      <input type={type} required={required} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
    </label>
  );

  return (
    <section className="admin-section">
      <h3>{editingId ? 'Edit movie' : 'Upload movie'}</h3>
      {message && <p className="notice">{message}</p>}
      <form className="admin-form" onSubmit={submitMovie}>
        {field('title', 'Title', 'text', true)}
        <label className="form-field">Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {field('genre', 'Genre')}{field('releaseYear', 'Release year', 'number')}{field('durationMinutes', 'Duration (minutes)', 'number')}
        {field('language', 'Language')}{field('country', 'Country')}{field('priceRwf', 'Price (RWF)', 'number', true)}
        <label className="form-field">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <label className="form-field">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="form-field">Movie file {editingId ? '(optional)' : ''}<input type="file" accept="video/mp4,video/webm,video/quicktime" required={!editingId} onChange={(event) => setMovieFile(event.target.files[0])} /></label>
        <label className="form-field">Poster image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPoster(event.target.files[0])} /></label>
        <div className="form-actions"><button className="primary-btn" type="submit">{editingId ? 'Save changes' : 'Upload movie'}</button>{editingId && <button className="secondary-btn" type="button" onClick={() => { setEditingId(null); setForm(emptyMovieForm); }}>Cancel edit</button>}</div>
      </form>
      <h3>All movies</h3>
      {error && <p className="notice error-notice">{error}</p>}
      <div className="management-list">{movies.map((movie) => <article className="management-row row-main" key={movie.id}><div><h4>{movie.title}</h4><p>{movie.category_name || 'Uncategorized'} · {formatPrice(movie.price_rwf)} · {movie.status}</p></div><div className="row-actions"><button type="button" className="secondary-btn" onClick={() => editMovie(movie)}>Edit</button>{movie.status !== 'archived' && <button type="button" className="danger-btn" onClick={() => archiveMovie(movie)}>Archive</button>}</div></article>)}</div>
    </section>
  );
}

function AdminPayments({ auth }) {
  const { data: orders, error, reload } = useAdminData(auth, '/payments/admin/orders', 'orders');
  const headers = { Authorization: `Bearer ${auth.token}` };
  const [message, setMessage] = useState('');

  const review = async (order, decision) => {
    const submissionId = order.latest_submission_id;
    if (!submissionId) return;
    let rejectionReason = '';
    if (decision === 'reject') {
      rejectionReason = window.prompt('Reason for rejection:', 'Payment could not be verified against official records.') || '';
      if (!rejectionReason.trim()) return;
    } else if (!window.confirm('Confirm you verified this payment using the official payment account or transaction records?')) return;
    try {
      const url = `/payments/admin/submissions/${submissionId}/${decision}`;
      const response = await api.patch(url, decision === 'reject' ? { rejectionReason } : {}, { headers });
      setMessage(response.data.message);
      reload();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Could not review payment.');
    }
  };

  return (
    <section className="admin-section"><h3>Payment review</h3><p className="notice">Manual verification only: compare the reference and amount with official payment account records. A user-entered reference is not proof of receipt by itself.</p>{message && <p className="notice">{message}</p>}{error && <p className="notice error-notice">{error}</p>}
      <div className="management-list">{orders.map((order) => <article className="management-row" key={order.id}><div className="row-main"><div><h4>{order.movie_title} · {order.user_name}</h4><p>{order.order_reference} · Ordered {formatPrice(order.amount_rwf)} · Submitted {order.submitted_amount_rwf ? formatPrice(order.submitted_amount_rwf) : 'not submitted'}</p><p>Reference: {order.transaction_reference || 'None supplied'} · Sender: {order.sender_phone || 'Not provided'}</p>{order.submission_notes && <p>Proof notes: {order.submission_notes}</p>}</div><span className={`state-badge state-${order.status}`}>{order.latest_submission_status || order.status}</span></div>{order.latest_submission_status === 'pending' && <div className="row-actions"><button className="primary-btn" type="button" onClick={() => review(order, 'approve')}>Approve verified payment</button><button className="danger-btn" type="button" onClick={() => review(order, 'reject')}>Reject</button></div>}</article>)}</div>
    </section>
  );
}

function AdminUsers({ auth }) {
  const { data: users, error, reload } = useAdminData(auth, '/admin/users', 'users');
  const headers = { Authorization: `Bearer ${auth.token}` };
  const [message, setMessage] = useState('');

  const changeStatus = async (user) => {
    const status = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status }, { headers });
      setMessage(`${user.full_name} is now ${status}.`);
      reload();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Could not update user.');
    }
  };

  return <section className="admin-section"><h3>User management</h3>{message && <p className="notice">{message}</p>}{error && <p className="notice error-notice">{error}</p>}<div className="management-list">{users.map((user) => <article className="management-row row-main" key={user.id}><div><h4>{user.full_name}</h4><p>{user.email} · {user.phone || 'No phone'} · {user.role_name} · {user.status}</p></div>{user.role_name !== 'admin' && <button className={user.status === 'active' ? 'danger-btn' : 'secondary-btn'} type="button" onClick={() => changeStatus(user)}>{user.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}</article>)}</div></section>;
}

function AdminPurchases({ auth }) {
  const { data: purchases, error, reload } = useAdminData(auth, '/payments/admin/purchases', 'purchases');
  const headers = { Authorization: `Bearer ${auth.token}` };
  const [message, setMessage] = useState('');
  const revoke = async (purchase) => {
    if (!window.confirm(`Revoke access to ${purchase.movie_title} for ${purchase.user_name}?`)) return;
    try {
      const response = await api.patch(`/payments/admin/purchases/${purchase.id}/revoke`, {}, { headers });
      setMessage(response.data.message);
      reload();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Could not revoke purchase.');
    }
  };
  return <section className="admin-section"><h3>Purchases</h3>{message && <p className="notice">{message}</p>}{error && <p className="notice error-notice">{error}</p>}<div className="management-list">{purchases.map((purchase) => <article className="management-row row-main" key={purchase.id}><div><h4>{purchase.movie_title}</h4><p>{purchase.user_name} · {formatPrice(purchase.amount_paid_rwf)} · {purchase.status} · {purchase.order_reference}</p></div><div className="row-actions"><span className={`state-badge state-${purchase.status}`}>{purchase.status}</span>{purchase.status === 'active' && <button type="button" className="danger-btn" onClick={() => revoke(purchase)}>Revoke access</button>}</div></article>)}</div></section>;
}

function AdminSettings({ auth }) {
  const [settings, setSettings] = useState({ providerName: '', paymentPhoneNumber: '', accountName: '', instructions: '', currency: 'RWF', isActive: true });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const headers = { Authorization: `Bearer ${auth.token}` };

  useEffect(() => {
    api.get('/payments/admin/settings', { headers })
      .then(({ data }) => {
        if (data.settings) setSettings({
          providerName: data.settings.provider_name,
          paymentPhoneNumber: data.settings.payment_phone_number,
          accountName: data.settings.account_name || '',
          instructions: data.settings.instructions || '',
          currency: data.settings.currency || 'RWF',
          isActive: Boolean(data.settings.is_active),
        });
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load settings.'));
  }, [auth.token]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api.put('/payments/admin/settings', settings, { headers });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save settings.');
    }
  };

  return <section className="admin-section"><h3>Payment settings</h3><p className="notice">These details are displayed to users when an order is created. The application does not automatically verify mobile money transfers.</p>{message && <p className="notice success-notice">{message}</p>}{error && <p className="notice error-notice">{error}</p>}<form className="admin-form settings-form" onSubmit={saveSettings}><label className="form-field">Payment method/provider<input required value={settings.providerName} onChange={(event) => setSettings({ ...settings, providerName: event.target.value })} /></label><label className="form-field">Payment telephone number<input required value={settings.paymentPhoneNumber} onChange={(event) => setSettings({ ...settings, paymentPhoneNumber: event.target.value })} /></label><label className="form-field">Official account name<input value={settings.accountName} onChange={(event) => setSettings({ ...settings, accountName: event.target.value })} /></label><label className="form-field">Instructions<textarea value={settings.instructions} onChange={(event) => setSettings({ ...settings, instructions: event.target.value })} /></label><label className="form-field checkbox-field"><input type="checkbox" checked={settings.isActive} onChange={(event) => setSettings({ ...settings, isActive: event.target.checked })} /> Accept new orders</label><button className="primary-btn" type="submit">Save payment settings</button></form></section>;
}

export default App;
