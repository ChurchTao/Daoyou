"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "../supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  createAnonymousUser: () => Promise<{ error: any }>;
  linkAnonymousUser: (
    email: string,
    password: string
  ) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 获取初始会话
    const getInitialSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      setIsLoading(false);
    };

    getInitialSession();

    // 监听会话变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // 注册
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  // 登录
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // 登出
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // 重置密码
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  // 创建匿名用户
  const createAnonymousUser = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error };
  };

  // 链接匿名用户到注册用户
  const linkAnonymousUser = async (email: string, password: string) => {
    const { error } = await supabase.auth.updateUser({
      email,
      password,
    });
    return { error };
  };

  const value = {
    session,
    user,
    isLoading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    createAnonymousUser,
    linkAnonymousUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
