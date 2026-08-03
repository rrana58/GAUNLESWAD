import React from "react";
import { UnifiedLoginPage } from "@shared/auth";
import api from "../utils/axios";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, loginWithSession } = useAuth();

  return (
    <UnifiedLoginPage
      api={api}
      currentUser={user}
      expectedRole="delivery"
      onAuthSuccess={(userData, accessToken, refreshToken) => {
        loginWithSession(userData, accessToken, refreshToken);
      }}
    />
  );
}
