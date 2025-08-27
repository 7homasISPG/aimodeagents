import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if user is stored in localStorage
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('authToken');
                
                if (storedUser && storedToken) {
                    setUser(JSON.parse(storedUser));
                    setIsAuthenticated(true);
                    
                    // TODO: Validate token with backend
                    // const response = await fetch('/api/auth/validate', {
                    //     headers: { Authorization: `Bearer ${storedToken}` }
                    // });
                    // if (!response.ok) {
                    //     throw new Error('Token invalid');
                    // }
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                // Clear invalid auth data
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
                setUser(null);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (credentials) => {
        try {
            setIsLoading(true);
            
            // TODO: Replace with actual API call
            // const response = await fetch('/api/auth/login', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(credentials)
            // });
            
            // if (!response.ok) {
            //     throw new Error('Login failed');
            // }
            
            // const data = await response.json();
            
            // Simulated login for now - replace with actual API response
            const mockUser = {
                id: '1',
                email: credentials.email,
                name: credentials.email.split('@')[0],
                avatar: null
            };
            
            const mockToken = 'mock-jwt-token-' + Date.now();
            
            // Store auth data
            localStorage.setItem('user', JSON.stringify(mockUser));
            localStorage.setItem('authToken', mockToken);
            
            setUser(mockUser);
            setIsAuthenticated(true);
            
            return { success: true, user: mockUser };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            // TODO: Call logout API
            // await fetch('/api/auth/logout', {
            //     method: 'POST',
            //     headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            // });
            
            // Clear auth data
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            
            setUser(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Logout error:', error);
            // Clear auth data even if API call fails
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    const register = async (userData) => {
        try {
            setIsLoading(true);
            
            // TODO: Replace with actual API call
            // const response = await fetch('/api/auth/register', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(userData)
            // });
            
            // if (!response.ok) {
            //     throw new Error('Registration failed');
            // }
            
            // const data = await response.json();
            
            // Simulated registration for now
            const mockUser = {
                id: Date.now().toString(),
                email: userData.email,
                name: userData.name || userData.email.split('@')[0],
                avatar: null
            };
            
            const mockToken = 'mock-jwt-token-' + Date.now();
            
            // Store auth data
            localStorage.setItem('user', JSON.stringify(mockUser));
            localStorage.setItem('authToken', mockToken);
            
            setUser(mockUser);
            setIsAuthenticated(true);
            
            return { success: true, user: mockUser };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        } finally {
            setIsLoading(false);
        }
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        register
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;

