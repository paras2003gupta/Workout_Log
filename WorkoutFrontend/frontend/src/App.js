import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';

// ==========================================================================
// Main App Component - Manages state and routing
// ==========================================================================
export default function App() {
    // Use environment variable for API URL, fallback for local dev
    const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001';

    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null); // Simple user state

    // Function to set token in state and localStorage
    const handleSetToken = (newToken) => {
        if (newToken) {
            localStorage.setItem('token', newToken);
            setToken(newToken);
            // In a real app, you'd fetch user details here
            setUser({ name: 'User' }); 
        } else {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
        }
    };

    // Check for token on initial load
    useEffect(() => {
        if (token) {
            setUser({ name: 'User' });
        }
    }, [token]);
    
    // Main layout with a new light theme
    return (
        <div className="bg-app-bg text-app-text min-h-screen font-sans">
            <div className="relative container mx-auto p-4 sm:p-6 lg:p-8 z-10">
                <Header user={user} onLogout={() => handleSetToken(null)} />
                <main className="mt-8">
                    {!user ? (
                        <AuthPage onSetToken={handleSetToken} apiUrl={API_URL} />
                    ) : (
                        <DashboardPage token={token} apiUrl={API_URL} />
                    )}
                </main>
            </div>
        </div>
    );
}

// ==========================================================================
// Reusable Components
// ==========================================================================

const Header = ({ user, onLogout }) => (
    <header className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-app-border">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-wider mb-4 sm:mb-0">
            <span role="img" aria-label="dumbbell" className="mr-3">💪</span>
            Workout<span className="text-blue-600">Log</span>
        </h1>
        {user && (
            <div className="flex items-center gap-4">
                 <span className="text-slate-600">Welcome, {user.name}!</span>
                 <button onClick={onLogout} className="btn-secondary text-sm">Logout</button>
            </div>
        )}
    </header>
);

const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
    </div>
);

const ErrorMessage = ({ message }) => (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
        <strong className="font-bold">🚨 Error: </strong>
        <span className="block sm:inline">{message}</span>
    </div>
);

// ==========================================================================
// Authentication Page Component
// ==========================================================================
const AuthPage = ({ onSetToken, apiUrl }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const endpoint = isLogin ? '/login' : '/register';
        try {
            const response = await axios.post(`${apiUrl}${endpoint}`, { username, password });
            if (isLogin) {
                onSetToken(response.data.token);
            } else {
                setIsLogin(true);
                alert('✅ Registration successful! Please log in.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto ui-card p-8">
            <h2 className="text-3xl font-bold text-center mb-6 text-slate-800">{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
            {error && <ErrorMessage message={error} />}
            <form onSubmit={handleSubmit} className="space-y-6">
                 <div><label className="label-style">Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-style" required /></div>
                 <div><label className="label-style">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-style" required /></div>
                 <button type="submit" disabled={loading} className="w-full btn-primary">{loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}</button>
            </form>
            <p className="text-center mt-6 text-slate-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:underline font-semibold">{isLogin ? 'Sign up' : 'Sign in'}</button>
            </p>
        </div>
    );
};

// ==========================================================================
// Dashboard Page - Main view after login
// ==========================================================================
const DashboardPage = ({ token, apiUrl }) => {
    const [workouts, setWorkouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filter, setFilter] = useState('');

    const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio"];

    const fetchWorkouts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page: currentPage, per_page: 5 };
            if (filter) params.muscle_group = filter;
            const response = await axios.get(`${apiUrl}/api/workouts`, { headers: { 'x-access-token': token }, params });
            setWorkouts(response.data.workouts);
            setTotalPages(response.data.total_pages);
        } catch (err) { setError('Failed to fetch workouts.'); } 
        finally { setLoading(false); }
    }, [apiUrl, token, currentPage, filter]);

    useEffect(() => { fetchWorkouts() }, [fetchWorkouts]);
    
    const handleSaveWorkout = async (workoutData) => {
        try {
            const method = editingWorkout ? 'put' : 'post';
            const url = editingWorkout ? `${apiUrl}/api/workouts/${editingWorkout.id}` : `${apiUrl}/api/workouts`;
            await axios[method](url, workoutData, { headers: { 'x-access-token': token } });
            closeForm();
            fetchWorkouts(); // Refetch to show the new/updated workout
        } catch (err) { setError('Failed to save workout.'); }
    };
    
    const handleDelete = async (workoutId) => {
        if (window.confirm('Are you sure you want to delete this workout?')) {
            try {
                await axios.delete(`${apiUrl}/api/workouts/${workoutId}`, { headers: { 'x-access-token': token } });
                fetchWorkouts(); // Refetch to remove the workout
            } catch (err) { setError('Failed to delete workout.'); }
        }
    };

    const openEditForm = (workout) => { setEditingWorkout(workout); setIsFormOpen(true); };
    const openCreateForm = () => { setEditingWorkout(null); setIsFormOpen(true); };
    const closeForm = () => { setIsFormOpen(false); setEditingWorkout(null); };
    const handleFilterChange = (e) => { setFilter(e.target.value); setCurrentPage(1); };

    return (
        <div className="space-y-6">
            {error && <ErrorMessage message={error} />}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 ui-card">
                <button onClick={openCreateForm} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">➕ Log New Workout</button>
                <select value={filter} onChange={handleFilterChange} className="input-style w-full sm:w-auto">
                    <option value="">Filter by Muscle Group</option>
                    {MUSCLE_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
            </div>

            {isFormOpen && <WorkoutForm onSave={handleSaveWorkout} onCancel={closeForm} initialData={editingWorkout} muscleGroups={MUSCLE_GROUPS} />}
            
            <div className="ui-card p-6">
                 <h2 className="text-xl font-bold text-slate-800 mb-4">Workout History</h2>
                {loading ? <LoadingSpinner /> : <WorkoutList workouts={workouts} onEdit={openEditForm} onDelete={handleDelete} />}
            </div>


            {!loading && totalPages > 1 && (
                 <div className="flex justify-center items-center gap-4 mt-6">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary">Previous</button>
                    <span className="font-semibold text-slate-600">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary">Next</button>
                </div>
            )}
        </div>
    );
}

// ==========================================================================
// Workout Form Component (Create/Edit)
// ==========================================================================
const WorkoutForm = ({ onSave, onCancel, initialData, muscleGroups }) => {
    const [formData, setFormData] = useState({
        exercise_name: '', muscle_group: muscleGroups[0], sets: '', reps: '', weight_kg: '', is_cardio: false, ...initialData
    });

    const isCardio = formData.is_cardio;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, sets: parseInt(formData.sets) || 0, reps: parseInt(formData.reps) || 0, weight_kg: parseFloat(formData.weight_kg) || 0 });
    };

    return (
        <div className="p-6 rounded-lg shadow-lg ui-card">
             <h3 className="text-xl font-bold mb-6 text-slate-800">{initialData ? '✏️ Edit Workout' : '📝 Log a New Workout'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="sm:col-span-2"><label className="label-style">Exercise Name</label><input type="text" name="exercise_name" value={formData.exercise_name} onChange={handleChange} required className="mt-1 w-full input-style" /></div>
                <div><label className="label-style">Muscle Group</label><select name="muscle_group" value={formData.muscle_group} onChange={handleChange} required className="mt-1 w-full input-style">{muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                
                <div className="sm:col-span-2 flex items-center gap-3 mt-2"><input type="checkbox" id="is_cardio" name="is_cardio" checked={formData.is_cardio} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/><label htmlFor="is_cardio" className="text-sm font-medium">Cardio exercise?</label></div>
                
                <div><label className="label-style">Weight (kg)</label><input type="number" step="0.5" name="weight_kg" value={formData.weight_kg} onChange={handleChange} required={!isCardio} disabled={isCardio} className={`mt-1 w-full input-style ${isCardio && 'disabled-input'}`} /></div>
                <div><label className="label-style">Sets</label><input type="number" name="sets" value={formData.sets} onChange={handleChange} required={!isCardio} disabled={isCardio} className={`mt-1 w-full input-style ${isCardio && 'disabled-input'}`} /></div>
                <div><label className="label-style">Reps</label><input type="number" name="reps" value={formData.reps} onChange={handleChange} required={!isCardio} disabled={isCardio} className={`mt-1 w-full input-style ${isCardio && 'disabled-input'}`} /></div>

                <div className="sm:col-span-2 flex justify-end gap-4 mt-4"><button type="button" onClick={onCancel} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save Workout</button></div>
            </form>
        </div>
    );
};

// ==========================================================================
// Workout List & Item Components
// ==========================================================================

const WorkoutList = ({ workouts, onEdit, onDelete }) => {
    if (workouts.length === 0) {
        return <div className="text-center text-slate-500 p-8"><h3 className="font-semibold">No workouts logged yet.</h3><p>Add one to get started!</p></div>;
    }
    return (
        <div className="space-y-4">
            {workouts.map(workout => <WorkoutItem key={workout.id} workout={workout} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
    );
};

const WorkoutItem = ({ workout, onEdit, onDelete }) => (
    <div className="border border-app-border rounded-lg p-4 transition-all hover:border-blue-500/50 hover:bg-slate-50">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="font-semibold text-lg text-slate-800">{workout.exercise_name}</h4>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full mt-1 inline-block">{workout.muscle_group}</span>
            </div>
            <div className="flex gap-2 self-start">
                <button onClick={() => onEdit(workout)} className="text-slate-500 hover:text-yellow-600 text-xl transition-colors p-2 rounded-full hover:bg-yellow-100">✏️</button>
                <button onClick={() => onDelete(workout.id)} className="text-slate-500 hover:text-red-600 text-xl transition-colors p-2 rounded-full hover:bg-red-100">🗑️</button>
            </div>
        </div>

        <div className="mt-4 border-t border-app-border pt-4">
             <table className="w-full text-sm text-left">
                <tbody>
                    <tr className="border-b border-app-border/50">
                        <td className="py-2 pr-4 font-medium text-slate-600">Date</td>
                        <td className="py-2 text-slate-800">{new Date(workout.created_at).toLocaleDateString()}</td>
                    </tr>
                    {!workout.is_cardio && (
                        <>
                            <tr className="border-b border-app-border/50">
                                <td className="py-2 pr-4 font-medium text-slate-600">Weight</td>
                                <td className="py-2 text-slate-800">{workout.weight_kg} kg</td>
                            </tr>
                            <tr className="border-b border-app-border/50">
                                <td className="py-2 pr-4 font-medium text-slate-600">Sets & Reps</td>
                                <td className="py-2 text-slate-800">{workout.sets} &times; {workout.reps}</td>
                            </tr>
                            <tr>
                                <td className="py-2 pr-4 font-medium text-slate-600">Volume</td>
                                <td className="py-2 font-bold text-blue-600">{workout.total_volume.toFixed(1)} kg</td>
                            </tr>
                        </>
                    )}
                     {workout.is_cardio && (
                        <tr>
                            <td className="py-2 pr-4 font-medium text-slate-600">Type</td>
                            <td className="py-2 font-bold text-blue-600">Cardio Session</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);


// ==========================================================================
// Global Styles Component
// ==========================================================================
const GlobalStyles = () => {
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --app-bg: #F1F5F9;
                --app-card: #FFFFFF;
                --app-border: #E2E8F0;
                --app-text: #334155;
                --app-blue: #2563EB;
                --app-blue-hover: #1D4ED8;
                --app-secondary-bg: #F1F5F9;
                --app-secondary-bg-hover: #E2E8F0;
                --app-secondary-text: #475569;
            }
            body { background-color: var(--app-bg); }
            .bg-app-bg { background-color: var(--app-bg); }
            .text-app-text { color: var(--app-text); }
            .ui-card {
                background-color: var(--app-card);
                border: 1px solid var(--app-border);
                border-radius: 0.75rem;
                box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05);
            }
            .input-style {
                width: 100%;
                padding: 0.625rem 0.75rem;
                background-color: #FFFFFF;
                border: 1px solid var(--app-border);
                border-radius: 0.375rem;
                color: var(--app-text);
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .input-style:focus {
                outline: none;
                border-color: var(--app-blue);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
            }
            .disabled-input {
                background-color: #F8FAFC;
                cursor: not-allowed;
                opacity: 0.7;
            }
            .btn-primary {
                background-color: var(--app-blue);
                color: white; font-weight: 600;
                padding: 0.625rem 1.25rem; border-radius: 0.375rem;
                transition: background-color 0.2s;
                box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            }
            .btn-primary:hover { background-color: var(--app-blue-hover); }
            .btn-primary:disabled { background-color: #94A3B8; color: #E2E8F0; cursor: not-allowed; }
            .btn-secondary {
                background-color: var(--app-secondary-bg);
                color: var(--app-secondary-text); font-weight: 600;
                padding: 0.5rem 1rem; border-radius: 0.375rem;
                transition: all 0.2s; border: 1px solid var(--app-border);
            }
            .btn-secondary:hover { background-color: var(--app-secondary-bg-hover); border-color: #CBD5E1; }
            .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
            .label-style { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #475569; }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);
    return null;
};

// ==========================================================================
// App Rendering
// ==========================================================================
const root = document.getElementById('root');
const reactRoot = ReactDOM.createRoot(root);
reactRoot.render(
    <React.StrictMode>
        <GlobalStyles />
        <App />
    </React.StrictMode>
);

