"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

export type AttendeeData = Record<number, Record<string, string>>;

/**
 * Manages per-ticket attendee form data and "Buy for myself" autofill.
 *
 * `attendeeData[ticketIndex][fieldKey] = value`
 */
export function useAttendeeData() {
  const user = useAuthStore((s) => s.user);
  const [attendeeData, setAttendeeData] = useState<AttendeeData>({});
  const [fillingMyData, setFillingMyData] = useState(false);

  const getFieldValue = (ticketIndex: number, fieldKey: string): string =>
    attendeeData[ticketIndex]?.[fieldKey] ?? "";

  const setFieldValue = (
    ticketIndex: number,
    fieldKey: string,
    value: string,
  ) => {
    setAttendeeData((prev) => ({
      ...prev,
      [ticketIndex]: {
        ...(prev[ticketIndex] ?? {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleBuyForMyself = useCallback(
    async (ticketIndex: number) => {
      if (!user) return;
      setFillingMyData(true);
      try {
        const res = await fetch(
          `/api/profiles/fetch?id=${user.id}&select=first_name,last_name`,
        );
        if (res.ok) {
          const { data } = await res.json();
          setAttendeeData((prev) => ({
            ...prev,
            [ticketIndex]: {
              ...(prev[ticketIndex] ?? {}),
              first_name: data?.first_name ?? "",
              last_name: data?.last_name ?? "",
              email: user.email ?? "",
            },
          }));
        }
      } catch {
        toast.error("Failed to load your details");
      } finally {
        setFillingMyData(false);
      }
    },
    [user],
  );

  return {
    user,
    attendeeData,
    getFieldValue,
    setFieldValue,
    handleBuyForMyself,
    fillingMyData,
  };
}
