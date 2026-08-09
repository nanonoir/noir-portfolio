"use client";

import { useEffect, useState } from "react";

function readFragmentToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
}

/** Reads the token from the URL fragment; consumers must never render or log it. */
export function useActionToken() {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const updateToken = () => {
      setToken(readFragmentToken());
      setIsReady(true);
    };

    updateToken();
    window.addEventListener("hashchange", updateToken);

    return () => window.removeEventListener("hashchange", updateToken);
  }, []);

  return { hasToken: Boolean(token), isReady, token };
}
