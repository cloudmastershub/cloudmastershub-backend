# CloudMastersHub - Component Breakdown for Developers

## Table of Contents
1. [Design System Overview](#design-system-overview)
2. [Atomic Components](#atomic-components)
3. [Composite Components](#composite-components)
4. [Page Components](#page-components)
5. [Layout Components](#layout-components)
6. [Implementation Guidelines](#implementation-guidelines)
7. [State Management](#state-management)
8. [Component Testing](#component-testing)

## Design System Overview

### Color System
```typescript
// colors.ts
export const colors = {
  primary: {
    black: '#0a0a0a',
    steel: '#4682B4',
    turquoise: '#40E0D0',
    lightTurquoise: '#7FFFD4',
  },
  text: {
    white: '#ffffff',
    gray: '#b0b0b0',
    dark: '#1a1a1a',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #40E0D0, #4682B4)',
    card: 'linear-gradient(135deg, #1a1a1a, #2a2a3a)',
    hero: 'radial-gradient(ellipse at center, rgba(64, 224, 208, 0.1) 0%, transparent 70%)',
    secondary: 'linear-gradient(135deg, #4682B4, #40E0D0)',
  }
} as const;
```

### Typography System
```typescript
// typography.ts
export const typography = {
  fontFamily: {
    primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  }
} as const;
```

### Spacing System
```typescript
// spacing.ts
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;
```

## Atomic Components

### 1. Button Component
```typescript
// components/atoms/Button.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    isLoading = false,
    leftIcon,
    rightIcon,
    children, 
    disabled,
    ...props 
  }, ref) => {
    const baseStyles = [
      'inline-flex items-center justify-center gap-2',
      'font-semibold transition-all duration-300',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ];

    const variants = {
      primary: [
        'bg-gradient-to-r from-turquoise to-steel',
        'text-white hover:shadow-lg',
        'hover:transform hover:-translate-y-1',
        'focus:ring-turquoise',
      ],
      secondary: [
        'bg-transparent border-2 border-turquoise',
        'text-turquoise hover:bg-turquoise hover:text-white',
        'focus:ring-turquoise',
      ],
      outline: [
        'bg-transparent border border-gray-300',
        'text-gray-300 hover:bg-gray-800',
        'focus:ring-gray-500',
      ],
      ghost: [
        'bg-transparent text-turquoise',
        'hover:bg-turquoise/10',
        'focus:ring-turquoise',
      ],
    };

    const sizes = {
      sm: ['px-3 py-1.5 text-sm rounded-lg'],
      md: ['px-6 py-2.5 text-base rounded-xl'],
      lg: ['px-8 py-4 text-lg rounded-2xl'],
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
            {children}
            {rightIcon && <span>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### 2. Input Component
```typescript
// components/atoms/Input.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = 'text',
    label,
    error,
    leftIcon,
    rightIcon,
    helperText,
    ...props 
  }, ref) => {
    const inputId = React.useId();

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">{leftIcon}</span>
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'block w-full px-4 py-3 rounded-lg',
              'bg-gray-800 border border-gray-600',
              'text-white placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-turquoise focus:border-transparent',
              'transition-colors duration-200',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <span className="text-gray-400">{rightIcon}</span>
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

### 3. Progress Bar Component
```typescript
// components/atoms/ProgressBar.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const variants = {
    default: 'bg-gradient-to-r from-turquoise to-steel',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-300">Progress</span>
          <span className="text-sm font-medium text-turquoise">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      
      <div className={cn(
        'w-full bg-gray-700 rounded-full overflow-hidden',
        sizes[size]
      )}>
        <div
          className={cn(
            'transition-all duration-500 ease-out rounded-full',
            variants[variant],
            sizes[size]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
```

### 4. Badge Component
```typescript
// components/atoms/Badge.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variants = {
    default: 'bg-gray-600 text-gray-100',
    success: 'bg-green-600 text-green-100',
    warning: 'bg-yellow-600 text-yellow-100',
    error: 'bg-red-600 text-red-100',
    info: 'bg-turquoise text-white',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};
```

## Composite Components

### 1. Course Card Component
```typescript
// components/molecules/CourseCard.tsx
import React from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { cn } from '@/lib/utils';

export interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  provider: 'aws' | 'azure' | 'gcp';
  duration: number; // in minutes
  lessonsCount: number;
  labsCount: number;
  progress?: number;
  isEnrolled?: boolean;
  className?: string;
  onEnroll?: (courseId: string) => void;
  onContinue?: (courseId: string) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  id,
  title,
  description,
  thumbnail,
  level,
  provider,
  duration,
  lessonsCount,
  labsCount,
  progress = 0,
  isEnrolled = false,
  className,
  onEnroll,
  onContinue,
}) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const levelColors = {
    beginner: 'success',
    intermediate: 'warning',
    advanced: 'error',
  } as const;

  const providerColors = {
    aws: 'bg-orange-600',
    azure: 'bg-blue-600',
    gcp: 'bg-green-600',
  };

  return (
    <div className={cn(
      'bg-gradient-to-br from-gray-800 to-gray-900',
      'border border-turquoise/20 rounded-2xl overflow-hidden',
      'transition-all duration-300 hover:transform hover:-translate-y-2',
      'hover:border-turquoise/40 hover:shadow-xl',
      'group cursor-pointer',
      className
    )}>
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
        
        {/* Provider Badge */}
        <div className={cn(
          'absolute top-4 left-4 px-3 py-1 rounded-full text-white text-sm font-medium',
          providerColors[provider]
        )}>
          {provider.toUpperCase()}
        </div>
        
        {/* Level Badge */}
        <div className="absolute top-4 right-4">
          <Badge variant={levelColors[level]} size="sm">
            {level}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
          {title}
        </h3>
        
        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          {description}
        </p>

        {/* Course Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <span>📚</span>
            {lessonsCount} lessons
          </span>
          <span className="flex items-center gap-1">
            <span>🧪</span>
            {labsCount} labs
          </span>
          <span className="flex items-center gap-1">
            <span>⏱️</span>
            {formatDuration(duration)}
          </span>
        </div>

        {/* Progress Bar (if enrolled) */}
        {isEnrolled && (
          <div className="mb-4">
            <ProgressBar
              value={progress}
              showLabel
              size="sm"
            />
          </div>
        )}

        {/* Action Button */}
        <Button
          variant={isEnrolled ? 'secondary' : 'primary'}
          size="md"
          className="w-full"
          onClick={() => {
            if (isEnrolled) {
              onContinue?.(id);
            } else {
              onEnroll?.(id);
            }
          }}
        >
          {isEnrolled ? 'Continue Learning' : 'Start Course'}
        </Button>
      </div>
    </div>
  );
};
```

### 2. Navigation Component
```typescript
// components/molecules/Navigation.tsx
import React from 'react';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';

export interface NavigationProps {
  isAuthenticated?: boolean;
  userAvatar?: string;
  userName?: string;
  onLogin?: () => void;
  onLogout?: () => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  isAuthenticated = false,
  userAvatar,
  userName,
  onLogin,
  onLogout,
  className,
}) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navLinks = [
    { href: '#home', label: 'Home' },
    { href: '#courses', label: 'Courses' },
    { href: '#labs', label: 'Labs' },
    { href: '#community', label: 'Community' },
    { href: '#pricing', label: 'Pricing' },
  ];

  return (
    <nav className={cn(
      'fixed top-0 w-full z-50',
      'bg-black/95 backdrop-blur-lg',
      'border-b border-turquoise/20',
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-turquoise to-steel bg-clip-text text-transparent">
              CloudMastersHub
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-300 hover:text-turquoise px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* User Actions */}
          <div className="hidden md:block">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {userAvatar && (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-300">{userName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={onLogin}>
                Get Started
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-900">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-turquoise block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-gray-700 pt-4">
              {isAuthenticated ? (
                <Button variant="ghost" size="sm" onClick={onLogout} className="w-full">
                  Logout
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={onLogin} className="w-full">
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
```

### 3. Learning Path Card Component
```typescript
// components/molecules/LearningPathCard.tsx
import React from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/utils';

export interface LearningPathCardProps {
  id: string;
  title: string;
  level: string;
  coursesCount: number;
  labsCount: number;
  projectsCount: number;
  topics: string[];
  gradient: string;
  onStart: (pathId: string) => void;
  className?: string;
}

export const LearningPathCard: React.FC<LearningPathCardProps> = ({
  id,
  title,
  level,
  coursesCount,
  labsCount,
  projectsCount,
  topics,
  gradient,
  onStart,
  className,
}) => {
  return (
    <div className={cn(
      'bg-gradient-to-br from-gray-800 to-gray-900',
      'border border-turquoise/20 rounded-2xl overflow-hidden',
      'transition-all duration-300 hover:transform hover:-translate-y-2',
      'hover:border-turquoise/40 hover:shadow-xl',
      className
    )}>
      {/* Header */}
      <div className={cn(
        'p-6 text-center text-white',
        gradient
      )}>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <Badge variant="info" size="sm">
          {level}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Stats */}
        <div className="flex justify-between items-center mb-6 text-sm text-gray-400">
          <span>{coursesCount} Courses</span>
          <span>{labsCount}+ Labs</span>
          <span>{projectsCount} Projects</span>
        </div>

        {/* Topics */}
        <div className="mb-6">
          <ul className="space-y-3">
            {topics.map((topic, index) => (
              <li
                key={index}
                className="flex items-center text-gray-300 text-sm border-b border-turquoise/10 pb-2"
              >
                <span className="w-2 h-2 bg-turquoise rounded-full mr-3 flex-shrink-0" />
                {topic}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button */}
        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => onStart(id)}
        >
          Start Path
        </Button>
      </div>
    </div>
  );
};
```

## Page Components

### 1. Dashboard Page Component
```typescript
// components/pages/Dashboard.tsx
import React from 'react';
import { ProgressCard } from '@/components/molecules/ProgressCard';
import { CourseCard } from '@/components/molecules/CourseCard';
import { Button } from '@/components/atoms/Button';

export interface DashboardProps {
  user: {
    name: string;
    avatar?: string;
  };
  stats: {
    overallProgress: number;
    labsCompleted: number;
    certifications: number;
    studyHours: number;
  };
  recentCourses: Course[];
  recommendations: Course[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  stats,
  recentCourses,
  recommendations,
}) => {
  return (
    <div className="min-h-screen bg-black pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user.name}!
          </h1>
          <p className="text-gray-400">
            Continue your cloud learning journey
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <ProgressCard
            title="Overall Progress"
            value={stats.overallProgress}
            suffix="%"
            icon="📊"
          />
          <ProgressCard
            title="Labs Completed"
            value={stats.labsCompleted}
            icon="🧪"
          />
          <ProgressCard
            title="Certifications"
            value={stats.certifications}
            icon="🏆"
          />
          <ProgressCard
            title="Study Hours"
            value={stats.studyHours}
            icon="⏱️"
          />
        </div>

        {/* Recent Courses */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Continue Learning</h2>
            <Button variant="secondary" size="sm">
              View All Courses
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentCourses.map((course) => (
              <CourseCard
                key={course.id}
                {...course}
                isEnrolled
              />
            ))}
          </div>
        </section>

        {/* Recommendations */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Recommended for You</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((course) => (
              <CourseCard
                key={course.id}
                {...course}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
```

## Layout Components

### 1. Main Layout Component
```typescript
// components/layout/Layout.tsx
import React from 'react';
import { Navigation } from '@/components/molecules/Navigation';
import { Footer } from '@/components/molecules/Footer';
import { cn } from '@/lib/utils';

export interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  showNavigation?: boolean;
  showFooter?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  className,
  showNavigation = true,
  showFooter = true,
}) => {
  return (
    <div className="min-h-screen bg-black">
      {showNavigation && <Navigation />}
      
      <main className={cn(
        'flex-1',
        showNavigation && 'pt-16',
        className
      )}>
        {children}
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};
```

## State Management

### 1. User Store (Zustand)
```typescript
// stores/userStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({
        user,
        isAuthenticated: true,
        isLoading: false,
      }),

      logout: () => set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      }),

      updateProfile: (updates) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...updates }
          });
        }
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### 2. Course Store (Zustand)
```typescript
// stores/courseStore.ts
import { create } from 'zustand';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  provider: 'aws' | 'azure' | 'gcp';
  duration: number;
  lessonsCount: number;
  labsCount: number;
  progress?: number;
  isEnrolled?: boolean;
}

interface CourseState {
  courses: Course[];
  enrolledCourses: Course[];
  currentCourse: Course | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCourses: (courses: Course[]) => void;
  enrollInCourse: (courseId: string) => Promise<void>;
  updateProgress: (courseId: string, progress: number) => void;
  setCurrentCourse: (course: Course | null) => void;
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  enrolledCourses: [],
  currentCourse: null,
  isLoading: false,
  error: null,

  setCourses: (courses) => set({ courses }),

  enrollInCourse: async (courseId) => {
    set({ isLoading: true, error: null });
    try {
      // API call to enroll
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to enroll');
      
      const { courses, enrolledCourses } = get();
      const course = courses.find(c => c.id === courseId);
      
      if (course) {
        set({
          enrolledCourses: [...enrolledCourses, { ...course, isEnrolled: true, progress: 0 }],
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  updateProgress: (courseId, progress) => {
    const { enrolledCourses } = get();
    const updatedCourses = enrolledCourses.map(course =>
      course.id === courseId ? { ...course, progress } : course
    );
    set({ enrolledCourses: updatedCourses });
  },

  setCurrentCourse: (course) => set({ currentCourse: course }),
}));
```

## Implementation Guidelines

### 1. File Structure
```
src/
├── components/
│   ├── atoms/           # Basic building blocks
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── ProgressBar.tsx
│   ├── molecules/       # Combinations of atoms
│   │   ├── CourseCard.tsx
│   │   ├── Navigation.tsx
│   │   └── LearningPathCard.tsx
│   ├── organisms/       # Complex components
│   │   ├── CourseGrid.tsx
│   │   ├── Dashboard.tsx
│   │   └── Header.tsx
│   ├── templates/       # Page layouts
│   │   ├── Layout.tsx
│   │   └── AuthLayout.tsx
│   └── pages/          # Complete pages
│       ├── HomePage.tsx
│       ├── CoursePage.tsx
│       └── DashboardPage.tsx
├── hooks/              # Custom React hooks
├── stores/             # State management
├── lib/                # Utilities
├── types/              # TypeScript types
└── styles/             # Global styles
```

### 2. Component Development Checklist
- [ ] TypeScript interfaces defined
- [ ] Responsive design implemented
- [ ] Accessibility attributes added
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Unit tests written
- [ ] Storybook stories created
- [ ] Performance optimized (React.memo, useMemo)

### 3. Best Practices
```typescript
// Use React.forwardRef for form elements
export const Input = React.forwardRef<HTMLInputElement, InputProps>(...);

// Use React.memo for expensive components
export const CourseCard = React.memo<CourseCardProps>(...);

// Use custom hooks for complex logic
const useEnrollment = (courseId: string) => {
  // Complex enrollment logic
};

// Use proper TypeScript typing
interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  customProp: string;
}
```

## Component Testing

### 1. Unit Test Example
```typescript
// __tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/atoms/Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button isLoading>Click me</Button>);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

### 2. Integration Test Example
```typescript
// __tests__/CourseCard.integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CourseCard } from '@/components/molecules/CourseCard';

const mockCourse = {
  id: '1',
  title: 'AWS Solutions Architect',
  description: 'Learn AWS fundamentals',
  thumbnail: '/thumb.jpg',
  level: 'beginner' as const,
  provider: 'aws' as const,
  duration: 120,
  lessonsCount: 10,
  labsCount: 5,
};

describe('CourseCard Integration', () => {
  it('handles enrollment flow', async () => {
    const handleEnroll = jest.fn();
    render(<CourseCard {...mockCourse} onEnroll={handleEnroll} />);
    
    const enrollButton = screen.getByText('Start Course');
    fireEvent.click(enrollButton);
    
    await waitFor(() => {
      expect(handleEnroll).toHaveBeenCalledWith('1');
    });
  });
});
```

This component breakdown provides a comprehensive foundation for building CloudMastersHub with a scalable, maintainable component architecture following React and TypeScript best practices.

