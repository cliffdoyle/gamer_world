import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import Head from 'next/head';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const SignupPage = () => {
  const [isClient, setIsClient] = useState(false);
  const { googleSignIn } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use router directly
  const router = useRouter();
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFormData = { ...formData };
    newFormData[e.target.name as keyof FormData] = e.target.value;
    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // TODO: Implement your register API call here
      // const response = await registerUser(formData);
      router.push('/login?registered=true');
    } catch (err: any) {
      setError((err && err.message) || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    try {
      if (credentialResponse.credential) {
        await googleSignIn(credentialResponse.credential);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError((err && err.message) || 'Google sign-in failed');
    }
  };

  if (!isClient) {
    return null; // Don't render anything on server
  }

  return (
    <div>
      <Head>
        <title>Sign Up - Gamer World</title>
        <style>{`
          @media (min-width: 768px) {
            .panels-container {
              flex-direction: row !important;
            }
            .left-panel {
              width: 50% !important;
              height: 100vh !important;
            }
            .right-panel {
              width: 50% !important;
              height: 100vh !important;
            }
          }
          .input-field:focus {
            border-color: #50f0b4 !important;
            box-shadow: 0 0 0 1px #50f0b4 !important;
          }
          .home-link:hover {
            color: #ffffff !important;
          }
          .signup-button:hover {
            background-color: #3ad8a3 !important;
            box-shadow: 0 0 10px rgba(80, 240, 180, 0.5) !important;
          }
          .login-link:hover {
            color: #3ad8a3 !important;
          }
        `}</style>
      </Head>
      
      {/* Main container with Neon-inspired design */}
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex',
        flexDirection: 'column',
        background: '#000000'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%'
        }}>
          {/* Two panel layout */}
          <div className="panels-container" style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: '100%'
          }}>
            {/* Left panel - Dark with neon accents */}
            <div className="left-panel" style={{ 
              backgroundColor: '#121212', 
              color: 'white',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '40vh',
              borderRight: '1px solid rgba(80, 240, 180, 0.3)'
            }}>
              <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                <h1 style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  color: '#50f0b4', // Neon green color
                  textShadow: '0 0 8px rgba(80, 240, 180, 0.8)'
                }}>
                  Gamer World
                </h1>
                <p style={{ 
                  fontSize: '1.1rem',
                  opacity: 0.9,
                  marginBottom: '2rem'
                }}>
                  For serious FIFA/FC players
                </p>
                <h2 style={{ 
                  fontSize: '1.8rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                }}>
                  Create your account
                </h2>
                <p style={{ opacity: 0.8 }}>
                  Join the community of competitive FIFA/FC players. Track your progress, find tournaments, and connect with other gamers.
                </p>
              </div>
            </div>

            {/* Right panel - Signup form with dark theme */}
            <div className="right-panel" style={{ 
              backgroundColor: '#1a1a1a',
              color: 'white',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              minHeight: '60vh'
            }}>
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <Link href="/" className="home-link" style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#aaaaaa',
                  marginBottom: '2rem',
                  textDecoration: 'none'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  <span>Home</span>
                </Link>

                <h2 style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 'bold',
                  marginBottom: '0.5rem',
                  color: '#ffffff'
                }}>
                  Sign up
                </h2>
                <p style={{ 
                  color: '#aaaaaa',
                  marginBottom: '2rem'
                }}>
                  Connect to Gamer World with:
                </p>

                {error && (
                  <div style={{ 
                    backgroundColor: 'rgba(127, 29, 29, 0.3)',
                    border: '1px solid #991b1b',
                    color: '#f87171',
                    padding: '1rem',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem'
                  }}>
                    {error}
                  </div>
                )}

                {/* Google Login */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => setError('Google login failed')}
                    useOneTap
                    theme="filled_black"
                    shape="rectangular"
                    text="signup_with"
                    logo_alignment="center"
                    width="100%"
                  />
                </div>

                {/* Divider */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  margin: '1.5rem 0'
                }}>
                  <div style={{ 
                    flexGrow: 1,
                    height: '1px',
                    backgroundColor: '#333333'
                  }}></div>
                  <div style={{ 
                    margin: '0 0.75rem',
                    color: '#888888',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    textTransform: 'uppercase'
                  }}>
                    OR SIGN UP WITH EMAIL
                  </div>
                  <div style={{ 
                    flexGrow: 1,
                    height: '1px',
                    backgroundColor: '#333333'
                  }}></div>
                </div>

                {/* Signup Form */}
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="username" style={{ 
                      display: 'block',
                      color: '#bbbbbb',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Username
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={formData.username}
                      onChange={handleInputChange}
                      className="input-field"
                      style={{ 
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#2a2a2a',
                        color: 'white',
                        border: '1px solid #444444',
                        borderRadius: '0.375rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="email" style={{ 
                      display: 'block',
                      color: '#bbbbbb',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="input-field"
                      style={{ 
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#2a2a2a',
                        color: 'white',
                        border: '1px solid #444444',
                        borderRadius: '0.375rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="password" style={{ 
                      display: 'block',
                      color: '#bbbbbb',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="input-field"
                      style={{ 
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#2a2a2a',
                        color: 'white',
                        border: '1px solid #444444',
                        borderRadius: '0.375rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="confirmPassword" style={{ 
                      display: 'block',
                      color: '#bbbbbb',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="input-field"
                      style={{ 
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#2a2a2a',
                        color: 'white',
                        border: '1px solid #444444',
                        borderRadius: '0.375rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="signup-button"
                    style={{ 
                      width: '100%',
                      backgroundColor: '#50f0b4',
                      color: '#121212',
                      fontWeight: '600',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background-color 0.2s, box-shadow 0.2s'
                    }}
                  >
                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                  </button>

                  <p style={{ 
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    color: '#aaaaaa'
                  }}>
                    Already have an account?{' '}
                    <Link href="/login" className="login-link" style={{ 
                      color: '#50f0b4',
                      fontWeight: '500',
                      textDecoration: 'none'
                    }}>
                      Log in
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage; 