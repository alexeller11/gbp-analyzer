export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login via Google OAuth — chama o backend que redireciona para accounts.google.com
export const getLoginUrl = () => {
  return `/api/auth/google-login`;
};
