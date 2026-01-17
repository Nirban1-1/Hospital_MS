import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.png';
import { BiMenu, BiX } from 'react-icons/bi';
import { jwtDecode } from 'jwt-decode';

const Header = () => {
  const headerRef = useRef(null);

  const [role, setRole] = useState(null);
  const [staffCategory, setStaffCategory] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useNavigate();

  /* ================= AUTH ================= */
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role);
        setStaffCategory(decoded.staff_category || null);
      } catch {
        setIsAuthenticated(false);
        setRole(null);
        setStaffCategory(null);
      }
    } else {
      setRole(null);
      setStaffCategory(null);
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener('authChange', checkAuth);
    return () => window.removeEventListener('authChange', checkAuth);
  }, []);

  /* ================= STICKY HEADER ================= */
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        headerRef.current.classList.add('sticky__header');
      } else {
        headerRef.current.classList.remove('sticky__header');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ================= ROUTES ================= */
  const getDashboardPathByRole = () => {
    switch (role) {
      case 'patient': return '/dashboard/patient';
      case 'doctor': return '/dashboard/doctor';
      case 'donor': return '/dashboard/donor';
      case 'ambulance_driver': return '/dashboard/driver';
      case 'staff':
        if (staffCategory === 'receptionist') return '/dashboard/receptionist';
        if (staffCategory === 'nurse') return '/dashboard/nurse';
        if (staffCategory === 'ward_boy') return '/dashboard/wardboy';
        return '/dashboard/receptionist';
      case 'admin': return '/admin-dashboard';
      default: return null;
    }
  };

  const navLinks = isAuthenticated
    ? [
        { path: '/home', display: 'Home' },
        { path: getDashboardPathByRole(), display: 'Dashboard' },
        ...(role === 'patient'
          ? [{ path: '/prescriptions', display: 'Prescriptions' }]
          : []),
        { path: '/account', display: 'Account' },
      ]
    : [{ path: '/home', display: 'Home' }];

  return (
    <header ref={headerRef} className="bg-white shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between h-[72px]">

          {/* Logo */}
          <Link to="/" onClick={() => setMenuOpen(false)}>
            <img src={logo} alt="Logo" className="h-9" />
          </Link>

          {/* Desktop Menu */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link, index) => (
              <li key={index}>
                <NavLink
                  to={link.path}
                  className={({ isActive }) =>
                    isActive
                      ? 'text-primaryColor font-semibold'
                      : 'text-gray-700 font-medium hover:text-primaryColor'
                  }
                >
                  {link.display}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-6">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  localStorage.clear();
                  window.dispatchEvent(new Event('authChange'));
                  navigate('/');
                }}
                className="text-sm font-semibold text-red-500 hover:underline"
              >
                Logout
              </button>
            ) : (
              <>
                {/* Login = text button */}
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm font-semibold text-primaryColor hover:underline"
                >
                  Login
                </button>

                {/* Sign up = small clean button */}
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-primaryColor text-white text-sm px-4 py-1.5 rounded-md font-semibold hover:opacity-90"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Icon */}
          <button
            className="md:hidden text-2xl"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <BiX /> : <BiMenu />}
          </button>
        </div>
      </div>

      {/* ================= MOBILE MENU ================= */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t shadow-lg">
          <ul className="flex flex-col gap-4 p-6">
            {navLinks.map((link, index) => (
              <li key={index}>
                <NavLink
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-700 font-medium"
                >
                  {link.display}
                </NavLink>
              </li>
            ))}

            <div className="pt-4 border-t flex flex-col gap-3">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    localStorage.clear();
                    setMenuOpen(false);
                    window.dispatchEvent(new Event('authChange'));
                    navigate('/');
                  }}
                  className="text-red-500 font-semibold text-left"
                >
                  Logout
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/login');
                    }}
                    className="text-primaryColor font-semibold text-left"
                  >
                    Login
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/signup');
                    }}
                    className="bg-primaryColor/10 text-primaryColor py-2 rounded-md font-semibold"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </ul>
        </div>
      )}
    </header>
  );
};

export default Header;
