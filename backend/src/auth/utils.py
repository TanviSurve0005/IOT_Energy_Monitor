from functools import wraps
from flask import request, jsonify, current_app
from .models import AuthToken

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Invalid authorization header'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        # Verify token
        payload = AuthToken.verify_token(token)
        if not payload:
            return jsonify({'message': 'Token is invalid or expired'}), 401
        
        # Add user info to request context
        request.user_id = payload['user_id']
        request.user_email = payload['email']
        
        return f(*args, **kwargs)
    
    return decorated

def validate_email_password(email, password):
    if not email or not password:
        return False, "Email and password are required"
    
    if len(password) < 6:
        return False, "Password must be at least 6 characters"
    
    # Basic email validation
    if '@' not in email or '.' not in email:
        return False, "Invalid email format"
    
    return True, "Valid"