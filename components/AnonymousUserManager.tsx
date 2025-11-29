'use client';

import { useEffect } from 'react';
import { useAuth } from '../lib/auth/AuthContext';

const AnonymousUserManager = () => {
  const { user, isLoading, createAnonymousUser } = useAuth();

  useEffect(() => {
    // 当没有用户且加载完成时，创建匿名用户
    if (!isLoading && !user) {
      createAnonymousUser();
    }
  }, [user, isLoading, createAnonymousUser]);

  return null;
};

export default AnonymousUserManager;
