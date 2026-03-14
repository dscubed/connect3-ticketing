import { useEffect, useRef, type ForwardedRef } from "react";

/**
 * Bridges a forwarded ref so the component always has a local ref to work with.
 */
export function useForwardedRef<T>(ref: ForwardedRef<T>) {
  const innerRef = useRef<T>(null);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(innerRef.current);
    } else {
      // eslint-disable-next-line react-hooks/immutability
      ref.current = innerRef.current;
    }
  });

  return innerRef;
}
