import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
import datetime
from functools import wraps

# ==============================================================================
# App Initialization
# ==============================================================================

app = Flask(__name__)

# --- Configuration ---
# In a real app, use environment variables for sensitive data.
# For this assignment, we'll set them directly.
app.config['SECRET_KEY'] = 'your-super-secret-key-for-jwt'
# Use an in-memory SQLite database for simplicity.
# For deployment on Render, you'd switch this to a PostgreSQL URL.
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///workout_log.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Extensions ---
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
# Allow requests from your React frontend (Vercel URL or localhost)
CORS(app)


# ==============================================================================
# OOP Principle: Encapsulation & Abstraction (Database Models)
# These classes encapsulate the data and behavior for users and their workouts.
# SQLAlchemy provides an abstraction layer over the raw SQL.
# ==============================================================================

class User(db.Model):
    """User Model for storing user details."""
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    workouts = db.relationship('Workout', backref='user', lazy=True, cascade="all, delete-orphan")

    def __init__(self, username, password):
        self.username = username
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class Workout(db.Model):
    """Workout Model for storing workout logs."""
    __tablename__ = 'workouts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Required Fields
    exercise_name = db.Column(db.String(120), nullable=False)  # Text field
    muscle_group = db.Column(db.String(50), nullable=False)  # Enum (handled as string)
    is_cardio = db.Column(db.Boolean, default=False, nullable=False)  # Boolean field

    # Inputs for calculated field
    sets = db.Column(db.Integer, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    weight_kg = db.Column(db.Float, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Calculated Field (as a property)
    @property
    def total_volume(self):
        """Calculates the total volume for the workout."""
        if self.is_cardio:
            return 0
        return self.sets * self.reps * self.weight_kg

    def to_dict(self):
        """Serializes the object to a dictionary."""
        return {
            'id': self.id,
            'exercise_name': self.exercise_name,
            'muscle_group': self.muscle_group,
            'is_cardio': self.is_cardio,
            'sets': self.sets,
            'reps': self.reps,
            'weight_kg': self.weight_kg,
            'total_volume': self.total_volume,
            'created_at': self.created_at.isoformat()
        }


# ==============================================================================
# Security: JWT Token Handling
# ==============================================================================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)

    return decorated


# ==============================================================================
# OOP Principle: Modularity (Routes are grouped by functionality)
# In a larger app, these would be in separate files (e.g., auth_routes.py)
# ==============================================================================

# --- Authentication Routes ---

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username and password are required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 409

    new_user = User(username=data['username'], password=data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'New user created!'}), 201


@app.route('/login', methods=['POST'])
def login():
    auth = request.get_json()
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401

    user = User.query.filter_by(username=auth['username']).first()
    if not user:
        return jsonify({'message': 'User not found'}), 401

    if user.check_password(auth['password']):
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token})

    return jsonify({'message': 'Wrong password'}), 401


# --- Add a simple root route for health check ---
@app.route('/')
def index():
    return jsonify({'status': 'ok', 'message': 'Workout Log API is running!'})


# --- Workout CRUD Routes ---

@app.route('/api/workouts', methods=['POST'])
@token_required
def create_workout(current_user):
    data = request.get_json()

    required_fields = ['exercise_name', 'muscle_group', 'sets', 'reps', 'weight_kg', 'is_cardio']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required fields'}), 400

    new_workout = Workout(
        user_id=current_user.id,
        exercise_name=data['exercise_name'],
        muscle_group=data['muscle_group'],
        is_cardio=data['is_cardio'],
        sets=data['sets'],
        reps=data['reps'],
        weight_kg=data['weight_kg']
    )
    db.session.add(new_workout)
    db.session.commit()
    return jsonify(new_workout.to_dict()), 201


@app.route('/api/workouts', methods=['GET'])
@token_required
def get_workouts(current_user):
    # --- Features: Pagination and Filtering ---
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 5, type=int)
    muscle_group_filter = request.args.get('muscle_group', None, type=str)

    query = Workout.query.filter_by(user_id=current_user.id)

    if muscle_group_filter:
        query = query.filter_by(muscle_group=muscle_group_filter)

    # Order by most recent
    query = query.order_by(Workout.created_at.desc())

    paginated_workouts = query.paginate(page=page, per_page=per_page, error_out=False)

    workouts_list = [w.to_dict() for w in paginated_workouts.items]

    return jsonify({
        'workouts': workouts_list,
        'total_pages': paginated_workouts.pages,
        'current_page': paginated_workouts.page,
        'has_next': paginated_workouts.has_next,
        'has_prev': paginated_workouts.has_prev
    })


@app.route('/api/workouts/<int:workout_id>', methods=['PUT'])
@token_required
def update_workout(current_user, workout_id):
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        return jsonify({'message': 'Workout not found or unauthorized'}), 404

    data = request.get_json()
    workout.exercise_name = data.get('exercise_name', workout.exercise_name)
    workout.muscle_group = data.get('muscle_group', workout.muscle_group)
    workout.is_cardio = data.get('is_cardio', workout.is_cardio)
    workout.sets = data.get('sets', workout.sets)
    workout.reps = data.get('reps', workout.reps)
    workout.weight_kg = data.get('weight_kg', workout.weight_kg)

    db.session.commit()
    return jsonify(workout.to_dict())


@app.route('/api/workouts/<int:workout_id>', methods=['DELETE'])
@token_required
def delete_workout(current_user, workout_id):
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        return jsonify({'message': 'Workout not found or unauthorized'}), 404

    db.session.delete(workout)
    db.session.commit()
    return jsonify({'message': 'Workout deleted successfully'})


# ==============================================================================
# Main Driver
# ==============================================================================
if __name__ == '__main__':
    # Create the database and tables if they don't exist
    with app.app_context():
        db.create_all()
    # For production, use a WSGI server like Gunicorn
    app.run(debug=True, port=5001)

